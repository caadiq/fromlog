/**
 * 에러 응답 유틸리티
 * 일관된 에러 응답 형식 제공
 */

/**
 * 에러 응답 전송
 * @param {object} reply - Fastify reply 객체
 * @param {number} statusCode - HTTP 상태 코드
 * @param {string} message - 에러 메시지
 * @returns {object} 에러 응답
 */
export function sendError(reply, statusCode, message) {
  return reply.code(statusCode).send({ error: message });
}

/**
 * 400 Bad Request
 */
export function badRequest(reply, message = '잘못된 요청입니다.') {
  return sendError(reply, 400, message);
}

/**
 * 401 Unauthorized
 */
export function unauthorized(reply, message = '인증이 필요합니다.') {
  return sendError(reply, 401, message);
}

/**
 * 404 Not Found
 */
export function notFound(reply, message = '리소스를 찾을 수 없습니다.') {
  return sendError(reply, 404, message);
}

/**
 * 409 Conflict
 */
export function conflict(reply, message = '이미 존재하는 리소스입니다.') {
  return sendError(reply, 409, message);
}

/**
 * 500 Internal Server Error
 */
export function serverError(reply, message = '서버 오류가 발생했습니다.') {
  return sendError(reply, 500, message);
}
