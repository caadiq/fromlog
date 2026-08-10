import { addOrUpdateSchedule, deleteSchedule } from '../../services/meilisearch/index.js';
import { uploadConcertPoster, uploadConcertMerchandise } from '../../services/image.js';
import { CATEGORY_IDS } from '../../config/index.js';
import { withTransaction } from '../../utils/transaction.js';
import { badRequest, serverError } from '../../utils/error.js';
import { logActivity } from '../../utils/log.js';

const CONCERT_CATEGORY_ID = CATEGORY_IDS.CONCERT;

/**
 * 콘서트 폼(multipart) 파싱 — 생성·수정 공통
 * keepMerchandiseIds는 수정에서만 쓰이고 생성은 무시한다.
 */
async function parseConcertForm(request) {
  let title = '';
  let rounds = [];
  let setlists = []; // 회차별 세트리스트 (배열의 배열)
  let keepMerchandiseIds = [];
  let posterBuffer = null;
  const merchandiseBuffers = [];

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      const buffer = await part.toBuffer();
      if (part.fieldname === 'poster') posterBuffer = buffer;
      else if (part.fieldname === 'merchandise') merchandiseBuffers.push(buffer);
    } else {
      if (part.fieldname === 'title') title = part.value;
      else if (part.fieldname === 'rounds') rounds = JSON.parse(part.value);
      else if (part.fieldname === 'setlists') setlists = JSON.parse(part.value);
      else if (part.fieldname === 'setlist') setlists = [JSON.parse(part.value)]; // 하위호환
      else if (part.fieldname === 'keepMerchandiseIds') keepMerchandiseIds = JSON.parse(part.value);
    }
  }

  return { title, rounds, setlists, keepMerchandiseIds, posterBuffer, merchandiseBuffers };
}

/**
 * 회차별 schedules + schedule_concert 생성 (venue가 신규면 함께 생성).
 * @returns {{scheduleIds: number[], concertIds: number[]}}
 */
async function insertConcertRounds(conn, { rounds, title, seriesId }) {
  const scheduleIds = [];
  const concertIds = [];

  for (const round of rounds) {
    let venueId = null;
    if (round.venueId) {
      venueId = round.venueId;
    } else if (round.venueName) {
      const [venueResult] = await conn.query(
        'INSERT INTO concert_venues (name, country, address, lat, lng) VALUES (?, ?, ?, ?, ?)',
        [round.venueName, round.venueCountry || null, round.venueAddress || null, round.venueLat || null, round.venueLng || null]
      );
      venueId = venueResult.insertId;
    }

    const [scheduleResult] = await conn.query(
      'INSERT INTO schedules (category_id, title, date, time) VALUES (?, ?, ?, ?)',
      [CONCERT_CATEGORY_ID, title.trim(), round.date, round.time || null]
    );
    const scheduleId = scheduleResult.insertId;
    scheduleIds.push(scheduleId);

    const [concertResult] = await conn.query(
      'INSERT INTO schedule_concert (schedule_id, series_id, venue_id) VALUES (?, ?, ?)',
      [scheduleId, seriesId, venueId]
    );
    concertIds.push(concertResult.insertId);
  }

  return { scheduleIds, concertIds };
}

/**
 * 회차별 세트리스트 + 곡별 멤버 생성.
 * setlists[roundIdx]가 없으면 setlists[0](공통) 사용.
 */
async function insertConcertSetlists(conn, concertIds, setlists) {
  for (let roundIdx = 0; roundIdx < concertIds.length; roundIdx++) {
    const concertId = concertIds[roundIdx];
    const roundSetlist = setlists[roundIdx] || setlists[0] || [];

    for (let i = 0; i < roundSetlist.length; i++) {
      const song = roundSetlist[i];
      if (!song.songName || !song.songName.trim()) continue;

      const [setlistResult] = await conn.query(
        'INSERT INTO concert_setlists (concert_id, order_num, song_name, album_name) VALUES (?, ?, ?, ?)',
        [concertId, i + 1, song.songName.trim(), song.albumName?.trim() || null]
      );

      if (song.memberIds && song.memberIds.length > 0) {
        const memberValues = song.memberIds.map((memberId) => [setlistResult.insertId, memberId]);
        await conn.query('INSERT INTO concert_setlist_members (setlist_id, member_id) VALUES ?', [memberValues]);
      }
    }
  }
}

/**
 * 생성·수정된 콘서트 회차들을 Meilisearch에 동기화 (트랜잭션 외부에서 호출).
 */
async function syncConcertSchedules(fastify, scheduleIds) {
  const { db, meilisearch, redis } = fastify;
  const [categoryRows] = await db.query('SELECT name, color FROM schedule_categories WHERE id = ?', [CONCERT_CATEGORY_ID]);
  const category = categoryRows[0] || {};

  for (const scheduleId of scheduleIds) {
    const [scheduleRows] = await db.query('SELECT title, date, time FROM schedules WHERE id = ?', [scheduleId]);
    const s = scheduleRows[0];
    if (s) {
      await addOrUpdateSchedule(meilisearch, {
        id: scheduleId,
        title: s.title,
        date: s.date instanceof Date ? s.date.toISOString().split('T')[0] : s.date,
        time: s.time || '',
        category_id: CONCERT_CATEGORY_ID,
        category_name: category.name || '',
        category_color: category.color || '',
      }, redis);
    }
  }
}

/**
 * 콘서트 관련 관리자 라우트
 */
export default async function concertRoutes(fastify) {
  const { db, meilisearch } = fastify;

  /**
   * GET /api/admin/concert/schedule/:seriesId
   * 콘서트 시리즈 상세 조회 (수정 폼용)
   */
  fastify.get('/schedule/:seriesId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { seriesId } = request.params;

    try {
      // 시리즈 기본 정보
      const [seriesRows] = await db.query(`
        SELECT cs.id, cs.title, cs.poster_id,
               i.original_url as poster_original, i.medium_url as poster_medium, i.thumb_url as poster_thumb
        FROM concert_series cs
        LEFT JOIN images i ON cs.poster_id = i.id
        WHERE cs.id = ?
      `, [seriesId]);

      if (seriesRows.length === 0) {
        return reply.code(404).send({ error: '콘서트를 찾을 수 없습니다.' });
      }

      const series = seriesRows[0];

      // 회차 정보 (schedules + schedule_concert + venue)
      const [roundRows] = await db.query(`
        SELECT s.id as schedule_id, sc.id as concert_id, s.date, s.time,
               cv.id as venue_id, cv.name as venue_name, cv.country as venue_country,
               cv.address as venue_address, cv.lat as venue_lat, cv.lng as venue_lng
        FROM schedule_concert sc
        JOIN schedules s ON sc.schedule_id = s.id
        LEFT JOIN concert_venues cv ON sc.venue_id = cv.id
        WHERE sc.series_id = ?
        ORDER BY s.date ASC, s.time ASC
      `, [seriesId]);

      // 회차별 세트리스트
      const rounds = [];
      const setlists = {};

      for (let i = 0; i < roundRows.length; i++) {
        const r = roundRows[i];
        const roundId = i + 1;

        rounds.push({
          id: roundId,
          scheduleId: r.schedule_id,
          concertId: r.concert_id,
          date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date?.split('T')[0] || '',
          time: r.time ? r.time.substring(0, 5) : '',
          venue: r.venue_id ? {
            id: r.venue_id,
            name: r.venue_name,
            country: r.venue_country,
            address: r.venue_address,
            lat: r.venue_lat,
            lng: r.venue_lng,
          } : null,
        });

        // 세트리스트
        const [setlistRows] = await db.query(`
          SELECT csl.id, csl.order_num, csl.song_name, csl.album_name
          FROM concert_setlists csl
          WHERE csl.concert_id = ?
          ORDER BY csl.order_num ASC
        `, [r.concert_id]);

        const songs = [];
        for (const song of setlistRows) {
          const [songMembers] = await db.query(
            'SELECT member_id FROM concert_setlist_members WHERE setlist_id = ?',
            [song.id]
          );
          songs.push({
            id: song.id,
            songName: song.song_name,
            albumName: song.album_name || '',
            memberIds: songMembers.map(m => m.member_id),
          });
        }

        setlists[roundId] = songs.length > 0 ? songs : [{ id: 1, songName: '', albumName: '', memberIds: [] }];
      }

      // 굿즈 이미지
      const [mdRows] = await db.query(`
        SELECT csm.id, csm.sort_order, i.original_url, i.medium_url, i.thumb_url
        FROM concert_series_md csm
        JOIN images i ON csm.image_id = i.id
        WHERE csm.series_id = ?
        ORDER BY csm.sort_order ASC
      `, [seriesId]);

      return {
        id: series.id,
        title: series.title,
        posterUrl: series.poster_medium || series.poster_original || null,
        rounds,
        setlists,
        merchandise: mdRows.map(m => ({
          id: m.id,
          originalUrl: m.original_url,
          mediumUrl: m.medium_url,
          thumbUrl: m.thumb_url,
        })),
      };
    } catch (err) {
      fastify.log.error(`콘서트 조회 오류: ${err.message}`);
      return serverError(reply, err.message);
    }
  });

  /**
   * PUT /api/admin/concert/schedule/:seriesId
   * 콘서트 일정 수정 (multipart/form-data)
   */
  fastify.put('/schedule/:seriesId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { seriesId } = request.params;
    const { title, rounds, setlists, keepMerchandiseIds, posterBuffer, merchandiseBuffers } =
      await parseConcertForm(request);

    if (!title?.trim()) {
      return badRequest(reply, '공연명은 필수입니다.');
    }
    if (!rounds || rounds.length === 0) {
      return badRequest(reply, '최소 1개 이상의 공연 일정이 필요합니다.');
    }

    let deletedScheduleIds = []; // 재생성 전 삭제된 회차 일정 ID (Meili 정리용)
    try {
      const result = await withTransaction(db, async (conn) => {
        // 1. 시리즈 업데이트
        await conn.query('UPDATE concert_series SET title = ? WHERE id = ?', [title.trim(), seriesId]);

        // 2. 포스터 업데이트
        if (posterBuffer) {
          const { originalUrl, mediumUrl, thumbUrl } = await uploadConcertPoster(seriesId, posterBuffer);
          const [existing] = await conn.query('SELECT poster_id FROM concert_series WHERE id = ?', [seriesId]);
          if (existing[0]?.poster_id) {
            await conn.query(
              'UPDATE images SET original_url = ?, medium_url = ?, thumb_url = ? WHERE id = ?',
              [originalUrl, mediumUrl, thumbUrl, existing[0].poster_id]
            );
          } else {
            const [imgResult] = await conn.query(
              'INSERT INTO images (original_url, medium_url, thumb_url) VALUES (?, ?, ?)',
              [originalUrl, mediumUrl, thumbUrl]
            );
            await conn.query('UPDATE concert_series SET poster_id = ? WHERE id = ?', [imgResult.insertId, seriesId]);
          }
        }

        // 3. 기존 회차 관련 데이터 삭제
        const [existingConcerts] = await conn.query(
          'SELECT sc.id as concert_id, sc.schedule_id FROM schedule_concert sc WHERE sc.series_id = ?',
          [seriesId]
        );

        if (existingConcerts.length > 0) {
          const concertIds = existingConcerts.map(c => c.concert_id);
          deletedScheduleIds = existingConcerts.map(c => c.schedule_id);

          // 세트리스트 멤버 삭제
          const [setlistRows] = await conn.query(
            'SELECT id FROM concert_setlists WHERE concert_id IN (?)', [concertIds]
          );
          if (setlistRows.length > 0) {
            await conn.query('DELETE FROM concert_setlist_members WHERE setlist_id IN (?)', [setlistRows.map(s => s.id)]);
          }
          await conn.query('DELETE FROM concert_setlists WHERE concert_id IN (?)', [concertIds]);
          await conn.query('DELETE FROM schedule_concert WHERE series_id = ?', [seriesId]);
          await conn.query('DELETE FROM schedules WHERE id IN (?)', [deletedScheduleIds]);
        }

        // 4. 회차(schedules + schedule_concert) 재생성
        const { scheduleIds: newScheduleIds, concertIds: newConcertIds } =
          await insertConcertRounds(conn, { rounds, title, seriesId });

        // 5. 회차별 세트리스트 재생성
        await insertConcertSetlists(conn, newConcertIds, setlists);

        // 6. 굿즈 관리 (유지할 것 외 삭제 + 새 파일 추가)
        const [existingMd] = await conn.query(
          'SELECT id, image_id FROM concert_series_md WHERE series_id = ?', [seriesId]
        );
        const keepSet = new Set(keepMerchandiseIds);
        const toDelete = existingMd.filter(m => !keepSet.has(m.id));

        for (const md of toDelete) {
          await conn.query('DELETE FROM concert_series_md WHERE id = ?', [md.id]);
          await conn.query('DELETE FROM images WHERE id = ?', [md.image_id]);
        }

        // 유지된 항목 순서 업데이트
        let sortOrder = 1;
        for (const keepId of keepMerchandiseIds) {
          await conn.query('UPDATE concert_series_md SET sort_order = ? WHERE id = ?', [sortOrder++, keepId]);
        }

        // 새 굿즈 추가
        for (const buffer of merchandiseBuffers) {
          const filename = `${String(sortOrder).padStart(2, '0')}.webp`;
          const { originalUrl, mediumUrl, thumbUrl } = await uploadConcertMerchandise(seriesId, filename, buffer);
          const [imgResult] = await conn.query(
            'INSERT INTO images (original_url, medium_url, thumb_url) VALUES (?, ?, ?)',
            [originalUrl, mediumUrl, thumbUrl]
          );
          await conn.query(
            'INSERT INTO concert_series_md (series_id, image_id, sort_order) VALUES (?, ?, ?)',
            [seriesId, imgResult.insertId, sortOrder++]
          );
        }

        return { scheduleIds: newScheduleIds };
      });

      // Meilisearch 동기화 — 삭제된 회차는 인덱스에서 제거(고아 문서 방지), 새 회차는 추가
      for (const delId of deletedScheduleIds) {
        await deleteSchedule(meilisearch, delId, fastify.redis);
      }
      await syncConcertSchedules(fastify, result.scheduleIds);

      logActivity(db, { actor: 'admin', action: 'update', category: 'concert', targetType: 'concert', targetId: parseInt(seriesId), summary: `콘서트 일정 수정: ${title}` });
      return { success: true, seriesId: parseInt(seriesId) };
    } catch (err) {
      fastify.log.error(`콘서트 수정 오류: ${err.message}`);
      return serverError(reply, err.message);
    }
  });

  /**
   * POST /api/admin/concert/schedule
   * 콘서트 일정 저장 (multipart/form-data)
   */
  fastify.post('/schedule', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { title, rounds, setlists, posterBuffer, merchandiseBuffers } = await parseConcertForm(request);

    // 검증
    if (!title || !title.trim()) {
      return badRequest(reply, '공연명은 필수입니다.');
    }
    if (!rounds || rounds.length === 0) {
      return badRequest(reply, '최소 1개 이상의 공연 일정이 필요합니다.');
    }
    for (const round of rounds) {
      if (!round.date) {
        return badRequest(reply, '모든 회차에 날짜는 필수입니다.');
      }
    }

    try {
      // 트랜잭션으로 DB 작업 수행
      const result = await withTransaction(db, async (conn) => {
        // 1. concert_series 생성
        const [seriesResult] = await conn.query(
          'INSERT INTO concert_series (title) VALUES (?)',
          [title.trim()]
        );
        const seriesId = seriesResult.insertId;

        // 2. 포스터 업로드 → images → concert_series.poster_id
        if (posterBuffer) {
          const { originalUrl, mediumUrl, thumbUrl } = await uploadConcertPoster(seriesId, posterBuffer);
          const [imageResult] = await conn.query(
            'INSERT INTO images (original_url, medium_url, thumb_url) VALUES (?, ?, ?)',
            [originalUrl, mediumUrl, thumbUrl]
          );
          await conn.query(
            'UPDATE concert_series SET poster_id = ? WHERE id = ?',
            [imageResult.insertId, seriesId]
          );
        }

        // 3. 회차(schedules + schedule_concert) 생성
        const { scheduleIds, concertIds } = await insertConcertRounds(conn, { rounds, title, seriesId });

        // 4. 회차별 세트리스트 저장
        await insertConcertSetlists(conn, concertIds, setlists);

        // 5. 굿즈(MD) 이미지 — 생성은 단순 순차 추가
        for (let i = 0; i < merchandiseBuffers.length; i++) {
          const filename = `${String(i + 1).padStart(2, '0')}.webp`;
          const { originalUrl, mediumUrl, thumbUrl } = await uploadConcertMerchandise(seriesId, filename, merchandiseBuffers[i]);

          const [imageResult] = await conn.query(
            'INSERT INTO images (original_url, medium_url, thumb_url) VALUES (?, ?, ?)',
            [originalUrl, mediumUrl, thumbUrl]
          );
          await conn.query(
            'INSERT INTO concert_series_md (series_id, image_id, sort_order) VALUES (?, ?, ?)',
            [seriesId, imageResult.insertId, i + 1]
          );
        }

        return { seriesId, scheduleIds };
      });

      // 6. Meilisearch 동기화 (트랜잭션 외부)
      await syncConcertSchedules(fastify, result.scheduleIds);

      logActivity(db, { actor: 'admin', action: 'create', category: 'concert', targetType: 'concert', targetId: result.seriesId, summary: `콘서트 일정 생성: ${title}` });
      return { success: true, seriesId: result.seriesId };
    } catch (err) {
      fastify.log.error(`콘서트 일정 저장 오류: ${err.message}`);
      return serverError(reply, err.message);
    }
  });
}
