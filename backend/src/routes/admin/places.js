import config from '../../config/index.js';
import { badRequest, serverError } from '../../utils/error.js';

const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY;
const GOOGLE_API_KEY = config.google.apiKey;

/**
 * 장소 검색 관리자 라우트
 * - 국내: 카카오맵 API
 * - 해외: 구글 Places API
 */
export default async function placesRoutes(fastify) {
  /**
   * GET /api/admin/kakao/places
   * 카카오맵 장소 검색 (국내)
   */
  fastify.get('/kakao/places', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { query } = request.query;

    if (!query || !query.trim()) {
      return badRequest(reply, '검색어를 입력해주세요.');
    }

    if (!KAKAO_REST_KEY) {
      return serverError(reply, '카카오 API 키가 설정되지 않았습니다.');
    }

    try {
      const response = await fetch(
        `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=15`,
        {
          headers: {
            Authorization: `KakaoAK ${KAKAO_REST_KEY}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        fastify.log.error(`카카오 API 오류: ${response.status} ${errorText}`);
        return serverError(reply, '카카오 API 호출 실패');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      fastify.log.error(`카카오 장소 검색 오류: ${err.message}`);
      return serverError(reply, err.message);
    }
  });

  /**
   * GET /api/admin/google/places
   * 구글 Places API 장소 검색 (해외)
   */
  fastify.get('/google/places', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { query } = request.query;

    if (!query || !query.trim()) {
      return badRequest(reply, '검색어를 입력해주세요.');
    }

    if (!GOOGLE_API_KEY) {
      return serverError(reply, 'Google API 키가 설정되지 않았습니다.');
    }

    try {
      // Places API (New) - Text Search
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        fastify.log.error(`Google Places API 오류: ${response.status} ${errorText}`);
        return serverError(reply, 'Google API 호출 실패');
      }

      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        fastify.log.error(`Google Places API 상태: ${data.status} - ${data.error_message || ''}`);
        return serverError(reply, `Google API 오류: ${data.status}`);
      }

      return data;
    } catch (err) {
      fastify.log.error(`구글 장소 검색 오류: ${err.message}`);
      return serverError(reply, err.message);
    }
  });
}
