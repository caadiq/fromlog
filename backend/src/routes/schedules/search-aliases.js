import { getAliases, saveAliases } from '../../services/searchAliases.js';
import { logActivity } from '../../utils/log.js';

export default async function searchAliasRoutes(fastify) {
  fastify.get('/aliases', { preHandler: [fastify.authenticate] }, async () => getAliases(fastify.db));
  fastify.put('/aliases', {
    preHandler: [fastify.authenticate], bodyLimit: 60000,
    schema: { body: { type: 'object', required: ['groups', 'disabledSchools', 'revision'], properties: {
      groups: { type: 'array', maxItems: 100, items: { type: 'object', required: ['canonical', 'aliases'], properties: {
        canonical: { type: 'string', minLength: 1, maxLength: 80 }, aliases: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'string', minLength: 1, maxLength: 80 } },
      } } }, disabledSchools: { type: 'array', maxItems: 300, items: { type: 'string', maxLength: 80 } }, revision: { type: 'string', minLength: 64, maxLength: 64 },
    } } },
  }, async (request, reply) => {
    try {
    const result = await saveAliases(fastify.db, request.body);
    logActivity(fastify.db, { actor: 'admin', action: 'update', category: 'dict', targetType: 'search_aliases', targetId: null, summary: `검색 별칭 저장: ${result.groups.length}개 그룹` });
    return result;
    } catch (error) {
      if (error.statusCode === 400 || error.statusCode === 409) return reply.code(error.statusCode).send({ error: error.message });
      fastify.log.error(error);
      return reply.code(500).send({ error: '검색 별칭을 저장하지 못했습니다.' });
    }
  });
}
