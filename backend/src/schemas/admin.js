/**
 * 관리자 API 스키마 (YouTube, X)
 */

// ==================== YouTube ====================

export const youtubeVideoInfo = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'YouTube URL' },
  },
  required: ['url'],
};

export const youtubeScheduleCreate = {
  type: 'object',
  properties: {
    videoId: { type: 'string', minLength: 11, maxLength: 11, description: 'YouTube 영상 ID' },
    title: { type: 'string', minLength: 1, maxLength: 500, description: '제목' },
    channelId: { type: 'string', description: '채널 ID' },
    channelName: { type: 'string', maxLength: 200, description: '채널명' },
    date: { type: 'string', format: 'date', description: '날짜 (YYYY-MM-DD)' },
    time: { type: 'string', pattern: '^\\d{2}:\\d{2}(:\\d{2})?$', description: '시간 (HH:MM 또는 HH:MM:SS)' },
    videoType: { type: 'string', enum: ['video', 'shorts'], default: 'video', description: '영상 유형' },
  },
  required: ['videoId', 'title', 'date'],
};

export const youtubeScheduleUpdate = {
  type: 'object',
  properties: {
    videoType: { type: 'string', enum: ['video', 'shorts'], description: '영상 유형' },
  },
};

// ==================== X (Twitter) ====================

export const xPostInfoQuery = {
  type: 'object',
  properties: {
    postId: { type: 'string', pattern: '^\\d+$', description: '게시글 ID' },
    username: { type: 'string', default: 'realfromis_9', description: '사용자명' },
  },
  required: ['postId'],
};

export const xScheduleCreate = {
  type: 'object',
  properties: {
    postId: { type: 'string', pattern: '^\\d+$', description: '게시글 ID' },
    title: { type: 'string', minLength: 1, maxLength: 500, description: '제목' },
    content: { type: 'string', maxLength: 5000, description: '게시글 내용' },
    imageUrls: { type: 'array', items: { type: 'string', format: 'uri' }, description: '이미지 URL 목록' },
    date: { type: 'string', format: 'date', description: '날짜 (YYYY-MM-DD)' },
    time: { type: 'string', pattern: '^\\d{2}:\\d{2}(:\\d{2})?$', description: '시간' },
  },
  required: ['postId', 'title', 'date'],
};
