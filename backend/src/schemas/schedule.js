/**
 * 일정 스키마
 */

export const scheduleCategory = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    color: { type: 'string' },
    sort_order: { type: 'integer' },
  },
};

export const scheduleMember = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
  },
};

export const scheduleResponse = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    title: { type: 'string' },
    date: { type: 'string', format: 'date' },
    time: { type: 'string', nullable: true },
    category: scheduleCategory,
    members: { type: 'array', items: scheduleMember },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

export const scheduleSearchQuery = {
  type: 'object',
  properties: {
    search: { type: 'string', description: '검색어' },
    year: { type: 'integer', minimum: 2000, maximum: 2100, description: '년도' },
    month: { type: 'integer', minimum: 1, maximum: 12, description: '월' },
    startDate: { type: 'string', format: 'date', description: '시작 날짜' },
    offset: { type: 'integer', default: 0, minimum: 0, description: '페이지 오프셋' },
    limit: { type: 'integer', default: 100, minimum: 1, maximum: 1000, description: '결과 개수' },
  },
};

export const scheduleSearchResponse = {
  type: 'object',
  properties: {
    schedules: { type: 'array', items: scheduleResponse },
    total: { type: 'integer' },
    offset: { type: 'integer' },
    limit: { type: 'integer' },
    hasMore: { type: 'boolean' },
  },
};
