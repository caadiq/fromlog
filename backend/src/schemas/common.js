/**
 * 공통 스키마
 */

export const errorResponse = {
  type: 'object',
  properties: {
    error: { type: 'string', description: '에러 메시지' },
  },
  required: ['error'],
};

export const successResponse = {
  type: 'object',
  properties: {
    message: { type: 'string', description: '성공 메시지' },
  },
};

export const paginationQuery = {
  type: 'object',
  properties: {
    offset: { type: 'integer', default: 0, minimum: 0, description: '페이지 오프셋' },
    limit: { type: 'integer', default: 20, minimum: 1, maximum: 100, description: '결과 개수' },
  },
};

export const idParam = {
  type: 'object',
  properties: {
    id: { type: 'integer', minimum: 1, description: 'ID' },
  },
  required: ['id'],
};
