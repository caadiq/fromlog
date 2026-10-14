import { scheduleImageLinks, readSchedulePoster } from '../../services/schedulePosters.js';
import { logActivity } from '../../utils/log.js';

export default async function schedulePosterRoutes(fastify) {
  fastify.get('/', { preHandler: [fastify.authenticate], schema: { querystring: {
    type: 'object', properties: { q: { type: 'string', maxLength: 500 }, offset: { type: 'integer', minimum: 0, maximum: 100000, default: 0 } },
  } } }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const q = (request.query.q || '').trim();
    const pattern = `%${q.replace(/[!%_]/g, value => `!${value}`)}%`;
    const [rows] = await fastify.db.query(`
      SELECT DISTINCT s.id AS scheduleId, s.title, DATE_FORMAT(s.date, '%Y-%m-%d') AS date,
        i.id AS imageId, COALESCE(i.thumb_url, i.medium_url, i.original_url) AS previewUrl
      FROM (${scheduleImageLinks}) attached
      JOIN schedules s ON s.id = attached.schedule_id JOIN images i ON i.id = attached.image_id
      WHERE s.title LIKE ? ESCAPE '!'
      ORDER BY (s.title = ?) DESC, s.date DESC, s.id DESC, i.id ASC LIMIT 31 OFFSET ?`,
    [pattern, q, request.query.offset]);
    return { items: rows.slice(0, 30), hasMore: rows.length > 30 };
  });

  fastify.post('/import', {
    preHandler: [fastify.authenticate], bodyLimit: 1024,
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    schema: { body: { type: 'object', additionalProperties: false, required: ['scheduleId', 'imageId'], properties: {
      scheduleId: { type: 'integer', minimum: 1 }, imageId: { type: 'integer', minimum: 1 },
    } } },
  }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const { scheduleId, imageId } = request.body;
    const [[image]] = await fastify.db.query(`
      SELECT i.original_url FROM (${scheduleImageLinks}) attached
      JOIN images i ON i.id = attached.image_id
      WHERE attached.schedule_id = ? AND i.id = ? LIMIT 1`, [scheduleId, imageId]);
    if (!image) return reply.code(404).send({ error: '이미지가 삭제되었거나 해당 일정에서 더 이상 사용하지 않습니다. 다시 검색해주세요.' });
    try {
      const result = await readSchedulePoster(image.original_url);
      logActivity(fastify.db, { actor: 'admin', action: 'upload', category: 'schedule', targetType: 'schedule_poster', targetId: scheduleId,
        summary: '기존 일정의 포스터 불러오기', details: { imageId } });
      return { name: `schedule-${scheduleId}-${imageId}.${result.extension}`, dataUrl: result.dataUrl };
    } catch (error) {
      request.log.warn({ scheduleId, imageId, error: error.message }, 'Schedule poster import failed');
      return reply.code(502).send({ error: '기존 이미지를 가져오지 못했습니다. 잠시 후 다시 시도하거나 파일을 첨부해주세요.' });
    }
  });
}
