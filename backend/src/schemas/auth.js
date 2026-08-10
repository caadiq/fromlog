/**
 * 인증 스키마
 */

export const loginRequest = {
  type: 'object',
  properties: {
    username: { type: 'string', minLength: 1, maxLength: 50, description: '사용자명' },
    password: { type: 'string', minLength: 1, maxLength: 100, description: '비밀번호' },
  },
  required: ['username', 'password'],
};

export const loginResponse = {
  type: 'object',
  properties: {
    token: { type: 'string', description: 'JWT 토큰' },
    expiresAt: { type: 'string', format: 'date-time', description: '만료 시간' },
  },
};
