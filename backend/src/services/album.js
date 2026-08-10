/**
 * 앨범 서비스
 * 앨범 관련 비즈니스 로직
 */
import { uploadAlbumCover, deleteAlbumCover, deleteAlbumPhoto, deleteAlbumVideo } from './image.js';
import { withTransaction } from '../utils/transaction.js';
import { getOrSet, invalidate, invalidatePattern, cacheKeys, TTL } from '../utils/cache.js';

/**
 * 앨범명 또는 폴더명으로 앨범 조회
 * @param {object} db - 데이터베이스 연결
 * @param {string} name - 앨범명 또는 폴더명
 * @returns {object|null} 앨범 정보 또는 null
 */
export async function getAlbumByName(db, name) {
  const [albums] = await db.query(
    'SELECT * FROM albums WHERE folder_name = ? OR title = ?',
    [name, name]
  );
  return albums.length > 0 ? albums[0] : null;
}

/**
 * ID로 앨범 조회
 * @param {object} db - 데이터베이스 연결
 * @param {number} id - 앨범 ID
 * @returns {object|null} 앨범 정보 또는 null
 */
export async function getAlbumById(db, id) {
  const [albums] = await db.query('SELECT * FROM albums WHERE id = ?', [id]);
  return albums.length > 0 ? albums[0] : null;
}

/**
 * 앨범 상세 정보 조회 (트랙, 티저, 컨셉포토 포함, 캐시 적용)
 * @param {object} db - 데이터베이스 연결
 * @param {object} album - 앨범 기본 정보
 * @param {object} redis - Redis 클라이언트 (선택적)
 * @returns {object} 상세 정보가 포함된 앨범
 */
export async function getAlbumDetails(db, album, redis = null) {
  const fetchDetails = async () => {
    // 트랙, 티저, 포토 병렬 조회
    const [[tracks], [teasers], [photos]] = await Promise.all([
      db.query(
        'SELECT * FROM album_tracks WHERE album_id = ? ORDER BY track_number',
        [album.id]
      ),
      db.query(
        `SELECT original_url, medium_url, thumb_url, video_url, media_type
         FROM album_teasers WHERE album_id = ? ORDER BY sort_order`,
        [album.id]
      ),
      db.query(
        `SELECT
          p.id, p.original_url, p.medium_url, p.thumb_url, p.photo_type, p.concept_name, p.sort_order,
          p.width, p.height,
          GROUP_CONCAT(m.name ORDER BY m.id SEPARATOR ', ') as members
        FROM album_photos p
        LEFT JOIN album_photo_members pm ON p.id = pm.photo_id
        LEFT JOIN members m ON pm.member_id = m.id
        WHERE p.album_id = ?
        GROUP BY p.id
        ORDER BY p.sort_order`,
        [album.id]
      ),
    ]);

    const result = { ...album };
    result.tracks = tracks;
    result.teasers = teasers;

    const conceptPhotos = {};
    for (const photo of photos) {
      const concept = photo.concept_name || 'Default';
      if (!conceptPhotos[concept]) {
        conceptPhotos[concept] = [];
      }
      conceptPhotos[concept].push({
        id: photo.id,
        original_url: photo.original_url,
        medium_url: photo.medium_url,
        thumb_url: photo.thumb_url,
        width: photo.width,
        height: photo.height,
        type: photo.photo_type,
        members: photo.members,
        sortOrder: photo.sort_order,
      });
    }
    result.conceptPhotos = conceptPhotos;

    return result;
  };

  if (redis) {
    return getOrSet(redis, cacheKeys.albumDetail(album.id), fetchDetails, TTL.LONG);
  }
  return fetchDetails();
}

/**
 * 앨범 목록과 트랙 조회 (N+1 최적화, 캐시 적용)
 * @param {object} db - 데이터베이스 연결
 * @param {object} redis - Redis 클라이언트 (선택적)
 * @returns {array} 트랙 포함된 앨범 목록
 */
export async function getAlbumsWithTracks(db, redis = null) {
  const fetchAlbums = async () => {
    const [albums] = await db.query(`
      SELECT id, title, folder_name, album_type, album_type_short, release_date,
             cover_original_url, cover_medium_url, cover_thumb_url, description
      FROM albums
      ORDER BY release_date DESC
    `);

    if (albums.length === 0) return albums;

    // 모든 트랙을 한 번에 조회
    const albumIds = albums.map(a => a.id);
    const [allTracks] = await db.query(
      `SELECT id, album_id, track_number, title, is_title_track, duration, lyricist, composer, arranger
       FROM album_tracks WHERE album_id IN (?) ORDER BY album_id, track_number`,
      [albumIds]
    );

    // 앨범 ID별로 트랙 그룹화
    const tracksByAlbum = {};
    for (const track of allTracks) {
      if (!tracksByAlbum[track.album_id]) {
        tracksByAlbum[track.album_id] = [];
      }
      tracksByAlbum[track.album_id].push(track);
    }

    // 각 앨범에 트랙 할당
    for (const album of albums) {
      album.tracks = tracksByAlbum[album.id] || [];
    }

    return albums;
  };

  if (redis) {
    return getOrSet(redis, cacheKeys.albums, fetchAlbums, TTL.LONG);
  }
  return fetchAlbums();
}

/**
 * 앨범 캐시 무효화
 * @param {object} redis - Redis 클라이언트
 * @param {number} albumId - 앨범 ID (선택적, 특정 앨범만 무효화)
 */
export async function invalidateAlbumCache(redis, albumId = null) {
  const keys = [cacheKeys.albums];
  if (albumId) {
    keys.push(cacheKeys.albumDetail(albumId));
  }
  await invalidate(redis, keys);
  // 앨범 이름 기반 캐시도 무효화 (패턴 매칭)
  await invalidatePattern(redis, 'album:name:*');
}

/**
 * 트랙 일괄 삽입
 * @param {object} connection - DB 연결
 * @param {number} albumId - 앨범 ID
 * @param {array} tracks - 트랙 목록
 */
async function insertTracks(connection, albumId, tracks) {
  if (!tracks || tracks.length === 0) return;

  const values = tracks.map(track => [
    albumId,
    track.track_number,
    track.title,
    track.duration || null,
    track.is_title_track ? 1 : 0,
    track.lyricist || null,
    track.composer || null,
    track.arranger || null,
    track.lyrics || null,
    track.video_url || null,
    track.video_type || null,
  ]);

  await connection.query(
    `INSERT INTO album_tracks
     (album_id, track_number, title, duration, is_title_track, lyricist, composer, arranger, lyrics, video_url, video_type)
     VALUES ?`,
    [values]
  );
}

/**
 * 앨범 생성
 * @param {object} db - 데이터베이스 연결 풀
 * @param {object} data - 앨범 데이터
 * @param {Buffer|null} coverBuffer - 커버 이미지 버퍼
 * @returns {object} 결과 메시지와 앨범 ID
 */
export async function createAlbum(db, data, coverBuffer) {
  const { title, album_type, album_type_short, release_date, folder_name, description, tracks } = data;

  return withTransaction(db, async (connection) => {
    // 커버 이미지 업로드
    let coverOriginalUrl = null;
    let coverMediumUrl = null;
    let coverThumbUrl = null;
    let themeColor = null;

    if (coverBuffer) {
      const urls = await uploadAlbumCover(folder_name, coverBuffer);
      coverOriginalUrl = urls.originalUrl;
      coverMediumUrl = urls.mediumUrl;
      coverThumbUrl = urls.thumbUrl;
      themeColor = urls.themeColor;
    }

    // 앨범 생성
    const [albumResult] = await connection.query(
      `INSERT INTO albums (title, album_type, album_type_short, release_date, folder_name,
                           cover_original_url, cover_medium_url, cover_thumb_url, theme_color, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, album_type, album_type_short || null, release_date, folder_name,
       coverOriginalUrl, coverMediumUrl, coverThumbUrl, themeColor, description || null]
    );

    const albumId = albumResult.insertId;

    // 트랙 일괄 삽입
    await insertTracks(connection, albumId, tracks);

    return { message: '앨범이 생성되었습니다.', albumId };
  });
}

/**
 * 앨범 수정
 * @param {object} db - 데이터베이스 연결 풀
 * @param {number} id - 앨범 ID
 * @param {object} data - 앨범 데이터
 * @param {Buffer|null} coverBuffer - 커버 이미지 버퍼
 * @returns {object|null} 결과 메시지 또는 null(앨범 없음)
 */
export async function updateAlbum(db, id, data, coverBuffer) {
  const { title, album_type, album_type_short, release_date, folder_name, description, tracks } = data;

  // 앨범 존재 여부 먼저 확인 (트랜잭션 외부)
  const [existingAlbums] = await db.query('SELECT * FROM albums WHERE id = ?', [id]);
  if (existingAlbums.length === 0) {
    return null;
  }

  const existing = existingAlbums[0];

  return withTransaction(db, async (connection) => {
    // 커버 이미지 처리
    let coverOriginalUrl = existing.cover_original_url;
    let coverMediumUrl = existing.cover_medium_url;
    let coverThumbUrl = existing.cover_thumb_url;
    let themeColor = existing.theme_color;

    if (coverBuffer) {
      const urls = await uploadAlbumCover(folder_name, coverBuffer);
      coverOriginalUrl = urls.originalUrl;
      coverMediumUrl = urls.mediumUrl;
      coverThumbUrl = urls.thumbUrl;
      themeColor = urls.themeColor;
    }

    // 앨범 수정
    await connection.query(
      `UPDATE albums SET title = ?, album_type = ?, album_type_short = ?, release_date = ?,
                        folder_name = ?, cover_original_url = ?, cover_medium_url = ?,
                        cover_thumb_url = ?, theme_color = ?, description = ?
       WHERE id = ?`,
      [title, album_type, album_type_short || null, release_date, folder_name,
       coverOriginalUrl, coverMediumUrl, coverThumbUrl, themeColor, description || null, id]
    );

    // 기존 트랙 삭제 후 새로 삽입
    await connection.query('DELETE FROM album_tracks WHERE album_id = ?', [id]);
    await insertTracks(connection, id, tracks);

    return { message: '앨범이 수정되었습니다.' };
  });
}

/**
 * URL에서 파일명 추출
 * @param {string} url - S3 URL
 * @returns {string|null} 파일명
 */
function extractFilenameFromUrl(url) {
  if (!url) return null;
  const parts = url.split('/');
  return parts[parts.length - 1];
}

/**
 * 앨범 삭제
 * @param {object} db - 데이터베이스 연결 풀
 * @param {number} id - 앨범 ID
 * @returns {object|null} 결과 메시지 또는 null(앨범 없음)
 */
export async function deleteAlbum(db, id) {
  // 앨범 존재 여부 먼저 확인 (트랜잭션 외부)
  const [existingAlbums] = await db.query('SELECT * FROM albums WHERE id = ?', [id]);
  if (existingAlbums.length === 0) {
    return null;
  }

  const album = existingAlbums[0];
  const folderName = album.folder_name;

  // S3 파일 삭제를 위해 사진/티저 목록 조회 (트랜잭션 외부)
  const [[photos], [teasers]] = await Promise.all([
    db.query('SELECT original_url FROM album_photos WHERE album_id = ?', [id]),
    db.query('SELECT original_url, video_url FROM album_teasers WHERE album_id = ?', [id]),
  ]);

  return withTransaction(db, async (connection) => {
    // S3 파일 삭제 (병렬 처리)
    const s3DeletePromises = [];

    // 커버 이미지 삭제
    if (album.cover_original_url && folderName) {
      s3DeletePromises.push(deleteAlbumCover(folderName));
    }

    // 사진 삭제
    for (const photo of photos) {
      const filename = extractFilenameFromUrl(photo.original_url);
      if (filename && folderName) {
        s3DeletePromises.push(deleteAlbumPhoto(folderName, 'photo', filename));
      }
    }

    // 티저 삭제 (이미지 + 비디오)
    for (const teaser of teasers) {
      const filename = extractFilenameFromUrl(teaser.original_url);
      if (filename && folderName) {
        s3DeletePromises.push(deleteAlbumPhoto(folderName, 'teaser', filename));
      }
      const videoFilename = extractFilenameFromUrl(teaser.video_url);
      if (videoFilename && folderName) {
        s3DeletePromises.push(deleteAlbumVideo(folderName, videoFilename));
      }
    }

    await Promise.all(s3DeletePromises);

    // DB 관련 데이터 삭제 (순서 중요: FK 제약조건)
    await connection.query(
      'DELETE FROM album_photo_members WHERE photo_id IN (SELECT id FROM album_photos WHERE album_id = ?)',
      [id]
    );
    await connection.query('DELETE FROM album_photos WHERE album_id = ?', [id]);
    await connection.query('DELETE FROM album_teasers WHERE album_id = ?', [id]);
    await connection.query('DELETE FROM album_tracks WHERE album_id = ?', [id]);
    await connection.query('DELETE FROM albums WHERE id = ?', [id]);

    return { message: '앨범이 삭제되었습니다.' };
  });
}
