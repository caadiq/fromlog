/**
 * Nitter 세션 등록 (크롬 확장 전용)
 *
 * X가 자동 로그인을 막아서 세션은 브라우저에서 뽑는 수밖에 없다.
 * 종전에는 F12로 쿠키를 찾아 sessions.jsonl을 손으로 고쳤는데,
 * 그 과정을 확장 버튼 하나로 줄인다 — 확장이 x.com 쿠키(auth_token·ct0·twid)를
 * 읽어 여기로 보내면, 같은 계정 줄을 갈아끼워 파일에 쓴다.
 * 재시작은 호스트 크론이 파일 변경을 보고 알아서 한다 (nitter/restart-on-session-change.sh).
 *
 * 인증: 관리자 JWT가 아니라 전용 키(X-Session-Key)다.
 * 확장에 JWT를 넣으면 만료 때마다 갱신해야 해서 목적에 어긋난다.
 */
import { readFile, writeFile } from 'fs/promises';
import { logActivity } from '../../utils/log.js';
import { badRequest, serverError } from '../../utils/error.js';

// 컨테이너에 마운트된 nitter 설정 폴더 (compose에서 /docker/nitter를 건다)
const SESSIONS_FILE = '/nitter/sessions.jsonl';

async function loadSessions() {
  try {
    const raw = await readFile(SESSIONS_FILE, 'utf8');
    return raw
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

const publicView = (sessions) =>
  sessions.map((s) => ({ username: s.username, id: s.id }));

export default async function nitterAdminRoutes(fastify) {
  const { db } = fastify;

  const checkKey = (request, reply) => {
    const key = process.env.NITTER_SESSION_KEY;
    if (!key || request.headers['x-session-key'] !== key) {
      reply.code(401).send({ error: '키가 올바르지 않습니다.' });
      return false;
    }
    return true;
  };

  /** GET /admin/nitter/session — 등록된 세션 목록 (토큰은 안 준다) */
  fastify.get('/session', async (request, reply) => {
    if (!checkKey(request, reply)) return reply;
    return { sessions: publicView(await loadSessions()) };
  });

  /**
   * PUT /admin/nitter/session — 세션 등록/갱신
   * body: { id, authToken, ct0, username? }
   * 같은 계정(id)이 있으면 토큰만 갈아끼우고 username은 유지한다.
   */
  fastify.put('/session', {
    schema: {
      body: {
        type: 'object',
        required: ['id', 'authToken', 'ct0'],
        properties: {
          id: { type: 'string', minLength: 5, maxLength: 30 },
          authToken: { type: 'string', minLength: 30, maxLength: 60 },
          ct0: { type: 'string', minLength: 100, maxLength: 200 },
          username: { type: 'string', maxLength: 50 },
        },
      },
    },
  }, async (request, reply) => {
    if (!checkKey(request, reply)) return reply;

    const { id, authToken, ct0, username } = request.body;
    if (!/^\d+$/.test(id)) return badRequest(reply, 'id는 숫자여야 합니다.');

    const sessions = await loadSessions();
    const existing = sessions.find((s) => s.id === id);
    const entry = {
      kind: 'cookie',
      username: existing?.username || username || `account-${id.slice(-6)}`,
      id,
      auth_token: authToken,
      ct0,
    };
    const next = existing
      ? sessions.map((s) => (s.id === id ? entry : s))
      : [...sessions, entry];

    try {
      await writeFile(
        SESSIONS_FILE,
        `${next.map((s) => JSON.stringify(s)).join('\n')}\n`,
      );
    } catch (err) {
      fastify.log.error(`nitter 세션 저장 실패: ${err.message}`);
      return serverError(reply, '세션 파일을 쓸 수 없습니다.');
    }

    logActivity(db, {
      actor: 'admin', action: 'update', category: 'bot',
      targetType: 'nitter_session', targetId: null,
      summary: `Nitter 세션 갱신: ${entry.username} (${existing ? '교체' : '추가'})`,
    });

    fastify.log.info(`[nitter] 세션 ${existing ? '교체' : '추가'}: ${entry.username}`);
    return {
      success: true,
      updated: entry.username,
      sessions: publicView(next),
      note: 'nitter는 1분 내 자동 재시작됩니다.',
    };
  });
}
