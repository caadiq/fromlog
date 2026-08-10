/**
 * 앨범 스키마
 */

export const albumTrack = {
  type: 'object',
  properties: {
    track_number: { type: 'integer', minimum: 1, description: '트랙 번호' },
    title: { type: 'string', minLength: 1, maxLength: 200, description: '트랙 제목' },
    duration: { type: 'string', pattern: '^\\d{1,2}:\\d{2}$', description: '재생 시간 (M:SS 또는 MM:SS)' },
    is_title_track: { type: 'boolean', description: '타이틀곡 여부' },
    lyricist: { type: 'string', maxLength: 500, description: '작사가' },
    composer: { type: 'string', maxLength: 500, description: '작곡가' },
    arranger: { type: 'string', maxLength: 500, description: '편곡가' },
    lyrics: { type: 'string', description: '가사' },
    music_video_url: { type: 'string', format: 'uri', description: '뮤직비디오 URL' },
  },
  required: ['track_number', 'title'],
};

export const albumCreate = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200, description: '앨범 제목' },
    album_type: { type: 'string', description: '앨범 유형 (정규, 미니, 싱글 등)' },
    album_type_short: { type: 'string', maxLength: 20, description: '앨범 유형 약자' },
    release_date: { type: 'string', format: 'date', description: '발매일 (YYYY-MM-DD)' },
    folder_name: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$', description: '폴더명 (영문, 숫자, -, _만 허용)' },
    description: { type: 'string', maxLength: 2000, description: '앨범 설명' },
    tracks: { type: 'array', items: albumTrack, description: '트랙 목록' },
  },
  required: ['title', 'album_type', 'release_date', 'folder_name'],
};

export const albumResponse = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    title: { type: 'string' },
    album_type: { type: 'string' },
    album_type_short: { type: 'string' },
    release_date: { type: 'string' },
    folder_name: { type: 'string' },
    cover_original_url: { type: 'string' },
    cover_medium_url: { type: 'string' },
    cover_thumb_url: { type: 'string' },
    description: { type: 'string' },
    tracks: { type: 'array', items: albumTrack },
  },
};

export const photoMetadata = {
  type: 'object',
  properties: {
    conceptName: { type: 'string', maxLength: 100, description: '컨셉 이름' },
    groupType: { type: 'string', enum: ['group', 'unit', 'solo'], description: '사진 유형' },
    members: { type: 'array', items: { type: 'integer' }, description: '멤버 ID 목록' },
  },
};

export const photoResponse = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    original_url: { type: 'string' },
    medium_url: { type: 'string' },
    thumb_url: { type: 'string' },
    photo_type: { type: 'string' },
    concept_name: { type: 'string' },
    sort_order: { type: 'integer' },
    width: { type: 'integer' },
    height: { type: 'integer' },
    members: { type: 'array', items: { type: 'integer' } },
  },
};
