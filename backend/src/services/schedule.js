/**
 * 스케줄 서비스
 * 스케줄 관련 비즈니스 로직
 */
import config, { CATEGORY_IDS, DEBUT_DATE } from '../config/index.js';
import { getOrSet, cacheKeys, TTL } from '../utils/cache.js';
import { formatTime } from '../utils/date.js';

// ==================== 공통 포맷팅 함수 ====================

/**
 * 날짜 문자열 정규화
 * @param {Date|string} date - 날짜
 * @returns {string} YYYY-MM-DD 형식
 */
export function normalizeDate(date) {
  if (!date) return '';
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  return String(date).split('T')[0];
}

/**
 * datetime 생성 (date + time)
 * @param {Date|string} date - 날짜
 * @param {string} time - 시간 (HH:mm:ss)
 * @returns {string} YYYY-MM-DDTHH:mm:ss 또는 YYYY-MM-DD
 */
export function buildDatetime(date, time) {
  const dateStr = normalizeDate(date);
  return time ? `${dateStr}T${time}` : dateStr;
}

/**
 * source 객체 생성
 * @param {object} schedule - 일정 원본 데이터
 * @returns {object|null} { name, url } 또는 null
 */
export function buildSource(schedule) {
  const { category_id, youtube_video_id, youtube_video_type, youtube_channel, x_post_id, x_username } = schedule;

  if (category_id === CATEGORY_IDS.YOUTUBE) {
    if (youtube_video_id) {
      const url = youtube_video_type === 'shorts'
        ? `https://www.youtube.com/shorts/${youtube_video_id}`
        : `https://www.youtube.com/watch?v=${youtube_video_id}`;
      return {
        name: youtube_channel || 'YouTube',
        url,
      };
    } else if (youtube_channel) {
      // 예정 일정: video_id 없이 채널 이름만
      return {
        name: youtube_channel,
        url: null,
      };
    }
  }

  if (category_id === CATEGORY_IDS.X && x_post_id) {
    const username = x_username || config.x.defaultUsername;
    return {
      name: username,
      url: `https://x.com/${username}/status/${x_post_id}`,
    };
  }

  if (category_id === CATEGORY_IDS.EVENT && schedule.event_school_name) {
    return {
      name: schedule.event_school_name,
      url: null,
    };
  }

  return null;
}

/**
 * 단일 일정 포맷팅 (공통)
 * @param {object} rawSchedule - DB에서 조회한 원본 일정
 * @returns {object} 포맷된 일정 객체
 */
export function formatSchedule(rawSchedule) {
  const result = {
    id: rawSchedule.id,
    title: rawSchedule.title,
    date: normalizeDate(rawSchedule.date),
    datePrecision: rawSchedule.date_precision || 'day',
    time: rawSchedule.time || null,
    category: {
      id: rawSchedule.category_id,
      name: rawSchedule.category_name,
      color: rawSchedule.category_color,
    },
    source: buildSource(rawSchedule),
  };
  if (rawSchedule.concert_series_id) {
    result.concertSeriesId = rawSchedule.concert_series_id;
  }
  if (rawSchedule.album_folder) {
    // 앨범 발매 일정 — 클릭 시 앨범 상세로 이동
    result.albumFolder = rawSchedule.album_folder;
  }
  if (rawSchedule.event_subtype) {
    result.eventSubtype = rawSchedule.event_subtype;
    if (rawSchedule.event_school_name) {
      result.schoolName = rawSchedule.event_school_name;
    }
  }
  return result;
}

/**
 * 일정 목록 포맷팅 (공통)
 * @param {object[]} rawSchedules - DB에서 조회한 원본 일정 배열
 * @returns {object[]} 포맷된 일정 배열
 */
export function formatSchedules(rawSchedules) {
  return rawSchedules.map(s => formatSchedule(s));
}

// ==================== 카테고리 ====================

/**
 * 카테고리 목록 조회 (캐시 적용)
 * @param {object} db - 데이터베이스 연결
 * @param {object} redis - Redis 클라이언트 (선택적)
 * @returns {array} 카테고리 목록
 */
export async function getCategories(db, redis = null) {
  const fetchCategories = async () => {
    const [categories] = await db.query(
      'SELECT id, name, color, sort_order FROM schedule_categories ORDER BY sort_order ASC, id ASC'
    );
    return categories;
  };

  if (redis) {
    return getOrSet(redis, cacheKeys.categories, fetchCategories, TTL.VERY_LONG);
  }
  return fetchCategories();
}

// ==================== 일정 상세 ====================

/**
 * 일정 상세 조회
 * @param {object} db - 데이터베이스 연결
 * @param {number} id - 일정 ID
 * @param {Function} getXProfile - X 프로필 조회 함수 (선택적)
 * @returns {object|null} 일정 상세 또는 null
 */
export async function getScheduleDetail(db, id, getXProfile = null) {
  const [schedules] = await db.query(`
    SELECT
      s.*,
      c.name as category_name,
      c.color as category_color,
      sy.channel_name as youtube_channel,
      sy.channel_id as youtube_channel_id,
      sy.video_id as youtube_video_id,
      sy.video_type as youtube_video_type,
      sx.post_id as x_post_id,
      sx.username as x_username,
      sx.content as x_content,
      sx.image_urls as x_image_urls,
      sx.video_thumbnails as x_video_thumbnails,
      sx.card_data as x_card_data,
      sv.broadcaster as variety_broadcaster,
      sv.replay_url as variety_replay_url,
      svi.medium_url as variety_thumbnail_url,
      se.subtype as event_subtype,
      se.school_name as event_school_name,
      se.post_urls as event_post_urls,
      se.poster_image_ids as event_poster_image_ids,
      ev.id as event_venue_id,
      ev.name as event_venue_name,
      ev.address as event_venue_address,
      ev.road_address as event_venue_road_address,
      ev.lat as event_venue_lat,
      ev.lng as event_venue_lng,
      sec.description as etc_description,
      sec.post_urls as etc_post_urls,
      sec.poster_image_ids as etc_poster_image_ids,
      ecv.id as etc_venue_id,
      ecv.name as etc_venue_name,
      ecv.address as etc_venue_address,
      ecv.road_address as etc_venue_road_address,
      ecv.lat as etc_venue_lat,
      ecv.lng as etc_venue_lng,
      al.folder_name as album_folder,
      sf.format as fansign_format,
      sf.host as fansign_host,
      sf.post_urls as fansign_post_urls,
      st.stage as ticketing_stage,
      st.vendor as ticketing_vendor,
      st.ticket_url as ticketing_url,
      st.purchase_limit as ticketing_limit,
      st.presale_end as ticketing_presale_end,
      st.auth_start as ticketing_auth_start,
      st.auth_end as ticketing_auth_end,
      st.auth_note as ticketing_auth_note,
      st.post_urls as ticketing_post_urls,
      st.series_id as ticketing_series_id,
      st.pair_schedule_id as ticketing_pair_id
    FROM schedules s
    LEFT JOIN schedule_categories c ON s.category_id = c.id
    LEFT JOIN schedule_youtube sy ON s.id = sy.schedule_id
    LEFT JOIN schedule_x sx ON s.id = sx.schedule_id
    LEFT JOIN schedule_variety sv ON s.id = sv.schedule_id
    LEFT JOIN images svi ON sv.thumbnail_id = svi.id
    LEFT JOIN schedule_event se ON s.id = se.schedule_id
    LEFT JOIN event_venues ev ON se.venue_id = ev.id
    LEFT JOIN schedule_etc sec ON s.id = sec.schedule_id
    LEFT JOIN event_venues ecv ON sec.venue_id = ecv.id
    LEFT JOIN schedule_album sa ON s.id = sa.schedule_id
    LEFT JOIN albums al ON sa.album_id = al.id
    LEFT JOIN schedule_fansign sf ON s.id = sf.schedule_id
    LEFT JOIN schedule_ticketing st ON s.id = st.schedule_id
    WHERE s.id = ?
  `, [id]);

  if (schedules.length === 0) {
    return null;
  }

  const s = schedules[0];

  // 공통 필드
  const result = {
    id: s.id,
    title: s.title,
    date: normalizeDate(s.date),
    datePrecision: s.date_precision || 'day',
    time: s.time || null,
    category: {
      id: s.category_id,
      name: s.category_name,
      color: s.category_color,
    },
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };

  // 앨범 발매 일정 — 프론트에서 앨범 상세로 리다이렉트
  if (s.album_folder) {
    result.albumFolder = s.album_folder;
  }

  // 카테고리별 추가 필드
  if (s.category_id === CATEGORY_IDS.YOUTUBE) {
    enrichYoutube(s, result);
  } else if (s.category_id === CATEGORY_IDS.X && s.x_post_id) {
    await enrichX(s, result, getXProfile);
  } else if (s.category_id === CATEGORY_IDS.VARIETY && s.variety_broadcaster) {
    enrichVariety(s, result);
  } else if (s.category_id === CATEGORY_IDS.EVENT && s.event_subtype) {
    await enrichEvent(db, s, result);
  } else if (s.category_id === CATEGORY_IDS.FANSIGN && s.fansign_format) {
    enrichFansign(s, result);
  } else if (s.category_id === CATEGORY_IDS.CONCERT) {
    await enrichConcert(db, s, result, id);
  } else if (s.category_id === CATEGORY_IDS.TICKETING && s.ticketing_stage) {
    await enrichTicketing(db, s, result);
  } else if (s.category_id === CATEGORY_IDS.ETC) {
    await enrichEtc(db, s, result);
  }

  return result;
}

/** YouTube: 채널·영상 링크 (예정 일정은 채널만) */
function enrichYoutube(s, result) {
  // 채널 이름은 항상 반환 (예정 일정 포함)
  if (s.youtube_channel) {
    result.channelName = s.youtube_channel;
  }
  if (s.youtube_channel_id) {
    result.channelUrl = `https://www.youtube.com/channel/${s.youtube_channel_id}`;
  }
  // video_id가 있는 경우에만 영상 관련 필드 추가
  if (s.youtube_video_id) {
    result.videoId = s.youtube_video_id;
    result.videoType = s.youtube_video_type;
    result.videoUrl = s.youtube_video_type === 'shorts'
      ? `https://www.youtube.com/shorts/${s.youtube_video_id}`
      : `https://www.youtube.com/watch?v=${s.youtube_video_id}`;
  }
}

/** X: 트윗 본문·이미지·카드 + (선택) 프로필 */
async function enrichX(s, result, getXProfile) {
  const username = s.x_username || config.x.defaultUsername;
  result.postId = s.x_post_id;
  result.username = username;
  result.content = s.x_content || null;
  result.imageUrls = s.x_image_urls ? JSON.parse(s.x_image_urls) : [];
  result.videoThumbnails = s.x_video_thumbnails ? JSON.parse(s.x_video_thumbnails) : [];
  result.card = s.x_card_data ? JSON.parse(s.x_card_data) : null;
  result.postUrl = `https://x.com/${username}/status/${s.x_post_id}`;

  if (getXProfile) {
    const profile = await getXProfile(username);
    if (profile) {
      result.profile = {
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      };
    }
  }
}

/** 예능: 방송사·다시보기·썸네일 */
function enrichVariety(s, result) {
  result.broadcaster = s.variety_broadcaster;
  result.replayUrl = s.variety_replay_url || null;
  result.thumbnailUrl = s.variety_thumbnail_url || null;
}

/** 행사: 세부유형·학교·포스터·장소 */
async function enrichEvent(db, s, result) {
  result.subtype = s.event_subtype;
  result.schoolName = s.event_school_name || null;
  result.postUrls = s.event_post_urls
    ? (typeof s.event_post_urls === 'string' ? JSON.parse(s.event_post_urls) : s.event_post_urls)
    : [];

  const posterIds = s.event_poster_image_ids
    ? (typeof s.event_poster_image_ids === 'string' ? JSON.parse(s.event_poster_image_ids) : s.event_poster_image_ids)
    : [];
  if (posterIds.length > 0) {
    const [posterRows] = await db.query(
      `SELECT id, original_url, medium_url, thumb_url FROM images WHERE id IN (?) ORDER BY FIELD(id, ?)`,
      [posterIds, posterIds]
    );
    result.posters = posterRows.map(p => ({
      id: p.id,
      originalUrl: p.original_url,
      mediumUrl: p.medium_url,
      thumbUrl: p.thumb_url,
    }));
  } else {
    result.posters = [];
  }

  if (s.event_venue_id) {
    result.venue = {
      id: s.event_venue_id,
      name: s.event_venue_name,
      address: s.event_venue_address,
      roadAddress: s.event_venue_road_address,
      lat: s.event_venue_lat,
      lng: s.event_venue_lng,
    };
  } else {
    result.venue = null;
  }
}

/** 기타(공용): 설명·장소·포스터·링크 — 라디오·뮤지컬 등 잡다한 출연을 담는 유연 카테고리 */
async function enrichEtc(db, s, result) {
  result.description = s.etc_description || null;
  result.postUrls = s.etc_post_urls
    ? (typeof s.etc_post_urls === 'string' ? JSON.parse(s.etc_post_urls) : s.etc_post_urls)
    : [];

  const posterIds = s.etc_poster_image_ids
    ? (typeof s.etc_poster_image_ids === 'string' ? JSON.parse(s.etc_poster_image_ids) : s.etc_poster_image_ids)
    : [];
  if (posterIds.length > 0) {
    const [posterRows] = await db.query(
      `SELECT id, original_url, medium_url, thumb_url FROM images WHERE id IN (?) ORDER BY FIELD(id, ?)`,
      [posterIds, posterIds]
    );
    result.posters = posterRows.map(p => ({
      id: p.id,
      originalUrl: p.original_url,
      mediumUrl: p.medium_url,
      thumbUrl: p.thumb_url,
    }));
  } else {
    result.posters = [];
  }

  if (s.etc_venue_id) {
    result.venue = {
      id: s.etc_venue_id,
      name: s.etc_venue_name,
      address: s.etc_venue_address,
      roadAddress: s.etc_venue_road_address,
      lat: s.etc_venue_lat,
      lng: s.etc_venue_lng,
    };
  } else {
    result.venue = null;
  }
}

/** 팬사인회: 형태·주최·출처 (장소는 당첨자 개별 안내라 미표기) */
function enrichFansign(s, result) {
  result.format = s.fansign_format; // 'offline' | 'online' | 'both'
  result.host = s.fansign_host || null;
  result.postUrls = s.fansign_post_urls
    ? (typeof s.fansign_post_urls === 'string' ? JSON.parse(s.fansign_post_urls) : s.fansign_post_urls)
    : [];
}

/** 콘서트: 시리즈/포스터/장소/세트리스트(곡별 멤버)/굿즈/다른 회차 */
async function enrichConcert(db, s, result, id) {
    const [conRows] = await db.query(`
      SELECT sc.id AS concert_id, sc.series_id,
             cs.title AS series_title, cs.poster_id,
             cv.id AS venue_id, cv.name AS venue_name, cv.address AS venue_address,
             cv.country AS venue_country, cv.lat AS venue_lat, cv.lng AS venue_lng
      FROM schedule_concert sc
      LEFT JOIN concert_series cs ON sc.series_id = cs.id
      LEFT JOIN concert_venues cv ON sc.venue_id = cv.id
      WHERE sc.schedule_id = ?
    `, [id]);

    if (conRows.length > 0) {
      const con = conRows[0];
      result.seriesId = con.series_id;
      result.seriesTitle = con.series_title || null;
      // 세트리스트 유닛/솔로 무대 판별용 (곡별 멤버 수 비교 기준)
      const [[{ count: activeMemberCount }]] = await db.query(
        'SELECT COUNT(*) as count FROM members WHERE is_former = 0'
      );
      result.activeMemberCount = activeMemberCount;

      // 포스터
      if (con.poster_id) {
        const [posterRows] = await db.query(
          'SELECT original_url, medium_url, thumb_url FROM images WHERE id = ?',
          [con.poster_id]
        );
        result.poster = posterRows.length > 0 ? {
          originalUrl: posterRows[0].original_url,
          mediumUrl: posterRows[0].medium_url,
          thumbUrl: posterRows[0].thumb_url,
        } : null;
      } else {
        result.poster = null;
      }

      // 장소
      result.venue = con.venue_id ? {
        id: con.venue_id,
        name: con.venue_name,
        address: con.venue_address,
        country: con.venue_country,
        lat: con.venue_lat,
        lng: con.venue_lng,
      } : null;

      // 세트리스트 (이 회차) + 곡별 멤버
      const [songs] = await db.query(
        `SELECT id, order_num, song_name, album_name
         FROM concert_setlists WHERE concert_id = ? ORDER BY order_num ASC`,
        [con.concert_id]
      );
      const memberMap = {};
      if (songs.length > 0) {
        const songIds = songs.map(x => x.id);
        const [allMem] = await db.query(
          `SELECT csm.setlist_id, m.id, m.name
           FROM concert_setlist_members csm JOIN members m ON csm.member_id = m.id
           WHERE csm.setlist_id IN (?) ORDER BY m.id`,
          [songIds]
        );
        for (const row of allMem) {
          (memberMap[row.setlist_id] ||= []).push({ id: row.id, name: row.name });
        }
      }
      result.setlist = songs.map(song => ({
        id: song.id,
        order: song.order_num,
        songName: song.song_name,
        albumName: song.album_name || null,
        members: memberMap[song.id] || [],
      }));

      // 굿즈 + 다른 회차 (시리즈 기준)
      if (con.series_id) {
        const [md] = await db.query(
          `SELECT csm.id, i.original_url, i.medium_url, i.thumb_url
           FROM concert_series_md csm JOIN images i ON csm.image_id = i.id
           WHERE csm.series_id = ? ORDER BY csm.sort_order ASC`,
          [con.series_id]
        );
        result.merchandise = md.map(x => ({
          id: x.id,
          originalUrl: x.original_url,
          mediumUrl: x.medium_url,
          thumbUrl: x.thumb_url,
        }));

        const [rounds] = await db.query(
          `SELECT s2.id AS schedule_id, s2.date, s2.time
           FROM schedule_concert sc2 JOIN schedules s2 ON sc2.schedule_id = s2.id
           WHERE sc2.series_id = ? AND s2.id != ?
           ORDER BY s2.date ASC, s2.time ASC`,
          [con.series_id, id]
        );
        result.otherRounds = rounds.map(r => ({
          scheduleId: r.schedule_id,
          date: normalizeDate(r.date),
          time: r.time ? r.time.substring(0, 5) : null,
        }));
      } else {
        result.merchandise = [];
        result.otherRounds = [];
      }
    }
}

/** 티켓팅: 단계·예매처·매수 제한·인증 기간 + 세트 상대 일정 + 연결 콘서트 카드 */
async function enrichTicketing(db, s, result) {
    result.stage = s.ticketing_stage; // 'presale' | 'general'
    result.vendor = s.ticketing_vendor || null;
    result.ticketUrl = s.ticketing_url || null;
    result.purchaseLimit = s.ticketing_limit || null;
    // 인증 기간은 입력한 벽시계 시각 그대로 (타임존 해석 없이 'YYYY-MM-DD HH:mm')
    const fmtNaive = (d) => (d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : null);
    result.presaleEnd = fmtNaive(s.ticketing_presale_end);
    result.authStart = fmtNaive(s.ticketing_auth_start);
    result.authEnd = fmtNaive(s.ticketing_auth_end);
    result.authNote = s.ticketing_auth_note || null;
    result.postUrls = s.ticketing_post_urls
      ? (typeof s.ticketing_post_urls === 'string' ? JSON.parse(s.ticketing_post_urls) : s.ticketing_post_urls)
      : [];

    // 세트 상대 일정 (선예매 ↔ 일반예매)
    if (s.ticketing_pair_id) {
      const [pairRows] = await db.query(
        `SELECT s2.id, s2.date, s2.time, st2.stage
         FROM schedules s2 JOIN schedule_ticketing st2 ON s2.id = st2.schedule_id
         WHERE s2.id = ?`,
        [s.ticketing_pair_id]
      );
      result.pair = pairRows.length > 0 ? {
        scheduleId: pairRows[0].id,
        stage: pairRows[0].stage,
        date: normalizeDate(pairRows[0].date),
        time: pairRows[0].time ? pairRows[0].time.substring(0, 5) : null,
      } : null;
    } else {
      result.pair = null;
    }

    // 연결 콘서트 카드 (시리즈 제목·포스터·공연 기간·장소)
    if (s.ticketing_series_id) {
      const [seriesRows] = await db.query(
        'SELECT cs.title, i.thumb_url, i.medium_url FROM concert_series cs LEFT JOIN images i ON cs.poster_id = i.id WHERE cs.id = ?',
        [s.ticketing_series_id]
      );
      if (seriesRows.length > 0) {
        const [range] = await db.query(
          `SELECT MIN(s2.date) AS start_date, MAX(s2.date) AS end_date,
                  (SELECT cv.name FROM schedule_concert sc3
                   LEFT JOIN concert_venues cv ON sc3.venue_id = cv.id
                   WHERE sc3.series_id = ? AND cv.name IS NOT NULL LIMIT 1) AS venue_name,
                  (SELECT sc4.schedule_id FROM schedule_concert sc4
                   JOIN schedules s4 ON sc4.schedule_id = s4.id
                   WHERE sc4.series_id = ? ORDER BY s4.date ASC, s4.time ASC LIMIT 1) AS first_schedule_id
           FROM schedule_concert sc2 JOIN schedules s2 ON sc2.schedule_id = s2.id
           WHERE sc2.series_id = ?`,
          [s.ticketing_series_id, s.ticketing_series_id, s.ticketing_series_id]
        );
        result.concert = {
          seriesId: s.ticketing_series_id,
          title: seriesRows[0].title,
          posterThumbUrl: seriesRows[0].thumb_url || seriesRows[0].medium_url || null,
          startDate: range[0]?.start_date ? normalizeDate(range[0].start_date) : null,
          endDate: range[0]?.end_date ? normalizeDate(range[0].end_date) : null,
          venueName: range[0]?.venue_name || null,
          firstScheduleId: range[0]?.first_schedule_id || null,
        };
      } else {
        result.concert = null;
      }
    } else {
      result.concert = null;
    }
}

// ==================== 일정 목록 조회 ====================

/** 일정 목록 조회용 공통 SQL */
const SCHEDULE_LIST_SQL = `
  SELECT
    s.id,
    s.title,
    s.date,
    s.date_precision,
    s.time,
    s.category_id,
    c.name as category_name,
    c.color as category_color,
    sy.channel_name as youtube_channel,
    sy.video_id as youtube_video_id,
    sy.video_type as youtube_video_type,
    sx.post_id as x_post_id,
    sx.username as x_username,
    scon.series_id as concert_series_id,
    se.subtype as event_subtype,
    se.school_name as event_school_name,
    al.folder_name as album_folder
  FROM schedules s
  LEFT JOIN schedule_categories c ON s.category_id = c.id
  LEFT JOIN schedule_youtube sy ON s.id = sy.schedule_id
  LEFT JOIN schedule_x sx ON s.id = sx.schedule_id
  LEFT JOIN schedule_concert scon ON s.id = scon.schedule_id
  LEFT JOIN schedule_event se ON s.id = se.schedule_id
  LEFT JOIN schedule_album sa ON s.id = sa.schedule_id
  LEFT JOIN albums al ON sa.album_id = al.id
`;

/**
 * 월별 일정 조회 (생일 포함)
 * @param {object} db - 데이터베이스 연결
 * @param {number} year - 연도
 * @param {number} month - 월
 * @returns {object} { schedules: [] }
 */
export async function getMonthlySchedules(db, year, month, redis = null) {
  const run = async () => {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];

  // 일정 조회
  const [rawSchedules] = await db.query(
    `${SCHEDULE_LIST_SQL} WHERE s.date BETWEEN ? AND ? ORDER BY s.date ASC, s.time ASC`,
    [startDate, endDate]
  );

  // 일정 포맷팅
  const schedules = formatSchedules(rawSchedules);

  // 특수 카테고리 조회 (생일, 기념일)
  const [specialCategories] = await db.query(
    'SELECT id, name, color FROM schedule_categories WHERE id IN (?, ?)',
    [CATEGORY_IDS.BIRTHDAY, CATEGORY_IDS.DEBUT]
  );
  const categoryMap = {};
  for (const cat of specialCategories) {
    categoryMap[cat.id] = { id: cat.id, name: cat.name, color: cat.color };
  }

  // 생일 조회 및 추가
  const [birthdays] = await db.query(`
    SELECT m.id, m.name, m.name_en, m.birth_date,
           i.thumb_url as image_url
    FROM members m
    LEFT JOIN images i ON m.image_id = i.id
    WHERE m.is_former = 0 AND MONTH(m.birth_date) = ?
  `, [month]);

  for (const member of birthdays) {
    const birthDate = new Date(member.birth_date);
    if (year < birthDate.getFullYear()) continue;

    const birthdayDate = new Date(year, birthDate.getMonth(), birthDate.getDate());

    schedules.push({
      id: `birthday-${year}-${member.name_en.toLowerCase()}`,
      title: `HAPPY ${member.name_en} DAY`,
      date: birthdayDate.toISOString().split('T')[0],
      time: null,
      category: categoryMap[CATEGORY_IDS.BIRTHDAY],
      source: null,
      is_birthday: true,
      member_image: member.image_url,
    });
  }

  // 데뷔/주년 추가 (1월인 경우)
  if (month === DEBUT_DATE.month) {
    const debutYear = DEBUT_DATE.year;
    const anniversaryYear = year - debutYear;

    if (year >= debutYear) {
      const debutDate = new Date(year, DEBUT_DATE.month - 1, DEBUT_DATE.day);

      if (year === debutYear) {
        // 데뷔 당일
        schedules.push({
          id: `debut-${year}`,
          title: '프로미스나인 데뷔',
          date: debutDate.toISOString().split('T')[0],
          time: null,
          category: categoryMap[CATEGORY_IDS.DEBUT],
          source: null,
          is_debut: true,
        });
      } else {
        // N주년
        schedules.push({
          id: `anniversary-${year}`,
          title: `프로미스나인 데뷔 ${anniversaryYear}주년`,
          date: debutDate.toISOString().split('T')[0],
          time: null,
          category: categoryMap[CATEGORY_IDS.DEBUT],
          source: null,
          is_anniversary: true,
          anniversary_year: anniversaryYear,
        });
      }
    }
  }

  // 날짜순 정렬 (같은 날짜 내에서 특수 일정을 먼저 배치)
  schedules.sort((a, b) => {
    // 날짜 비교
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;

    // 같은 날짜면 특수 일정(생일, 기념일)을 먼저
    const aSpecial = a.is_birthday || a.is_debut || a.is_anniversary;
    const bSpecial = b.is_birthday || b.is_debut || b.is_anniversary;
    if (aSpecial && !bSpecial) return -1;
    if (!aSpecial && bSpecial) return 1;

    // 둘 다 특수 일정이면 기념일 > 생일 순서
    if (aSpecial && bSpecial) {
      const aDebut = a.is_debut || a.is_anniversary;
      const bDebut = b.is_debut || b.is_anniversary;
      if (aDebut && !bDebut) return -1;
      if (!aDebut && bDebut) return 1;
    }

    // 시간순 정렬
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;

    return 0;
  });

    return { schedules };
  };

  // 캘린더(최다 호출 공개 엔드포인트) 캐시. 쓰기 시 schedule:monthly:* 무효화 +
  // 짧은 TTL 안전망으로 혹시 빠진 경로도 자동 치유.
  if (redis) {
    return getOrSet(redis, cacheKeys.scheduleMonthly(year, month), run, TTL.SHORT);
  }
  return run();
}

/**
 * 다가오는 일정 조회
 * @param {object} db - 데이터베이스 연결
 * @param {string} startDate - 시작 날짜
 * @param {number} limit - 조회 개수
 * @returns {object} { schedules: [] }
 */
export async function getUpcomingSchedules(db, startDate, limit) {
  // 현재 시각(KST) — 오늘 일정 중 시간이 지난 것은 제외 (시간 미정은 자정까지 유지)
  const nowTime = formatTime(new Date());
  const upcomingCond = `(s.date > ? OR (s.date = ? AND (s.time IS NULL OR s.time >= ?)))`;
  const timeParams = [startDate, startDate, nowTime];

  // 컴백·앨범 일정은 limit과 별개로 항상 맨 위에 노출
  const FEATURED_CATEGORIES = [CATEGORY_IDS.COMEBACK, CATEGORY_IDS.ALBUM];
  const [featuredRows] = await db.query(
    `${SCHEDULE_LIST_SQL} WHERE s.date_precision = 'day' AND ${upcomingCond}
     AND s.category_id IN (?) ORDER BY s.date ASC, s.time ASC LIMIT 5`,
    [...timeParams, FEATURED_CATEGORIES]
  );

  // 확정 일정 (limit개, 컴백·앨범 제외 — 위에 이미 노출)
  const [dayRows] = await db.query(
    `${SCHEDULE_LIST_SQL} WHERE s.date_precision = 'day' AND ${upcomingCond}
     AND s.category_id NOT IN (?) ORDER BY s.date ASC, s.time ASC LIMIT ?`,
    [...timeParams, FEATURED_CATEGORIES, limit]
  );

  // 날짜 미정(월만 확정, 그 달 1일로 저장) 일정 — 해당 월이 지나기 전까지는
  // limit과 별개로 항상 포함 (일정 페이지 관례대로 확정 일정 뒤에 배치)
  const [monthRows] = await db.query(
    `${SCHEDULE_LIST_SQL} WHERE s.date_precision = 'month' AND LAST_DAY(s.date) >= ? ORDER BY s.date ASC`,
    [startDate]
  );

  const rawSchedules = [...featuredRows, ...dayRows, ...monthRows];

  // 일정 포맷팅
  const schedules = formatSchedules(rawSchedules);

  return { schedules };
}
