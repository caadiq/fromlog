import { importInstagramPosters, importInstagramCaption, normalizeInstagramPost } from '../../services/instagramPosters.js';
import { logActivity } from '../../utils/log.js';

export default async function instagramRoutes(fastify) {
  let importing = false;
  fastify.post('/caption', {
    preHandler: [fastify.authenticate],
    bodyLimit: 4096,
    config: { rateLimit: { max: 6, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    let postUrl;
    try { postUrl = normalizeInstagramPost(request.body?.url); }
    catch (error) { return reply.code(400).send({ error: error.message }); }
    if (importing) return reply.code(429).send({ error: '게시물을 가져오는 중입니다. 잠시 후 다시 시도해주세요.' });
    importing = true;
    try {
      const result = await importInstagramCaption(postUrl);
      logActivity(fastify.db, { actor: 'admin', action: 'upload', category: 'schedule', targetType: 'instagram_caption', summary: '일정 제목 편집용 인스타그램 본문 가져오기', details: { postUrl } });
      return result;
    } catch {
      logActivity(fastify.db, { actor: 'admin', action: 'error', category: 'schedule', targetType: 'instagram_caption', summary: '인스타그램 본문 가져오기 실패', details: { postUrl } });
      return reply.code(502).send({ error: '본문을 가져오지 못했습니다. 공개 게시물 링크인지 확인하거나 제목을 직접 입력해주세요.' });
    } finally { importing = false; }
  });

  fastify.post('/posters', {
    preHandler: [fastify.authenticate],
    bodyLimit: 4096,
    config: { rateLimit: { max: 6, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    let postUrl;
    try { postUrl = normalizeInstagramPost(request.body?.url); }
    catch (error) { return reply.code(400).send({ error: error.message }); }
    if (importing) return reply.code(429).send({ error: '이미지를 가져오는 중입니다. 잠시 후 다시 시도해주세요.' });
    importing = true;
    try {
      const result = await importInstagramPosters(postUrl);
      logActivity(fastify.db, {
        actor: 'admin', action: 'upload', category: 'schedule', targetType: 'instagram_poster',
        summary: `인스타그램 포스터 ${result.images.length}장 불러오기`,
        details: { postUrl, count: result.images.length },
      });
      return result;
    } catch {
      logActivity(fastify.db, {
        actor: 'admin', action: 'error', category: 'schedule', targetType: 'instagram_poster',
        summary: '인스타그램 포스터 불러오기 실패', details: { postUrl },
      });
      return reply.code(502).send({ error: '게시물 이미지를 가져오지 못했습니다. 공개 게시물 링크인지 확인하거나 파일 첨부를 이용해주세요.' });
    } finally { importing = false; }
  });
}
