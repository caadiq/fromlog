/**
 * 일정 페이지 고정 링크 (공개)
 * /api/schedule-links
 *
 * 투표·스밍 안내처럼 "지금 참여해야 하는 것"을 일정 페이지 상단에 고정으로 노출한다.
 * 노출 기간(starts_at ~ ends_at)에 걸린 것만 내려보내므로, 마감된 투표는 자동으로 사라진다.
 */
export default async function scheduleLinkRoutes(fastify) {
  const { db } = fastify;

  fastify.get('/', {
    schema: {
      tags: ['schedule'],
      summary: '일정 페이지 고정 링크 (노출 중인 것만)',
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              kind: { type: 'string' },
              title: { type: 'string' },
              url: { type: 'string' },
              endsAt: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
  }, async () => {
    const [rows] = await db.query(
      `SELECT id, kind, title, url,
              DATE_FORMAT(ends_at, '%Y-%m-%dT%H:%i') AS ends_at
         FROM schedule_links
        WHERE (starts_at IS NULL OR starts_at <= NOW())
          AND (ends_at   IS NULL OR ends_at   >= NOW())
        ORDER BY sort_order, id`
    );
    return rows.map(r => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      url: r.url,
      // 마감 배지(~8/16)용. 기간 제한이 없으면 null.
      // 타임존 없는 '벽시계' 문자열로 내려보낸다 — UTC로 표기하면 브라우저가 +9시간 밀어 읽는다.
      endsAt: r.ends_at || null,
    }));
  });
}
