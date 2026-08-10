import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fastifySwagger from '@fastify/swagger';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import config from './config/index.js';
import * as schemas from './schemas/index.js';
import { nowKST } from './utils/date.js';

// 플러그인
import dbPlugin from './plugins/db.js';
import redisPlugin from './plugins/redis.js';
import authPlugin from './plugins/auth.js';
import meilisearchPlugin from './plugins/meilisearch.js';
import youtubeBotPlugin from './services/youtube/index.js';
import xBotPlugin from './services/x/index.js';
import festivalBotPlugin from './services/festival/index.js';
import schedulerPlugin from './plugins/scheduler.js';

// 라우트
import routes from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildApp(opts = {}) {
  const fastify = Fastify({
    logger: {
      level: opts.logLevel || 'info',
    },
    ...opts,
  });

  // config 데코레이터 등록
  fastify.decorate('config', config);

  // CORS 설정 (API 문서 포털에서 테스트 요청 허용)
  await fastify.register(fastifyCors, {
    origin: ['https://docs.caadiq.co.kr'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // multipart 플러그인 등록 (파일 업로드용)
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  // rate-limit 플러그인 등록 (특정 라우트에만 적용)
  await fastify.register(rateLimit, {
    global: false,
  });

  // 플러그인 등록 (순서 중요)
  await fastify.register(dbPlugin);
  await fastify.register(redisPlugin);
  await fastify.register(authPlugin);
  await fastify.register(meilisearchPlugin);
  await fastify.register(youtubeBotPlugin);
  await fastify.register(xBotPlugin);
  await fastify.register(festivalBotPlugin);
  await fastify.register(schedulerPlugin);

  // 공유 스키마 등록 (라우트에서 $ref로 참조 가능)
  fastify.addSchema({ $id: 'Album', ...schemas.albumResponse });
  fastify.addSchema({ $id: 'AlbumTrack', ...schemas.albumTrack });
  fastify.addSchema({ $id: 'Schedule', ...schemas.scheduleResponse });
  fastify.addSchema({ $id: 'ScheduleCategory', ...schemas.scheduleCategory });
  fastify.addSchema({ $id: 'Member', ...schemas.memberResponse });
  fastify.addSchema({ $id: 'Photo', ...schemas.photoResponse });

  // Swagger (OpenAPI) 설정
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'fromlog API',
        description: '프롬로그 — fromis_9 팬 아카이브 백엔드 API',
        version: '2.0.0',
      },
      servers: [
        { url: '/', description: 'Current server' },
      ],
      tags: [
        { name: 'auth', description: '인증 API' },
        { name: 'members', description: '멤버 API' },
        { name: 'albums', description: '앨범 API' },
        { name: 'schedules', description: '일정 API' },
        { name: 'admin/youtube', description: 'YouTube 관리 API' },
        { name: 'admin/x', description: 'X (Twitter) 관리 API' },
        { name: 'admin/bots', description: '봇 관리 API' },
        { name: 'stats', description: '통계 API' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  // OpenAPI JSON 엔드포인트
  fastify.get('/docs/json', { schema: { hide: true } }, async () => {
    return fastify.swagger();
  });

  // 라우트 등록
  await fastify.register(routes, { prefix: '/api' });

  // 헬스 체크 엔드포인트
  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: nowKST() };
  });

  // 봇 상태 조회 엔드포인트 (공개)
  // 민감한 설정(채널/계정/필터)·에러 내부정보는 제외하고 상태 요약만 노출.
  // 관리자 화면은 인증된 /api/admin/bots를 사용한다.
  fastify.get('/api/bots', async () => {
    const bots = await fastify.scheduler.getBots();
    const statuses = await Promise.all(
      bots.map(async bot => {
        const status = await fastify.scheduler.getStatus(bot.id);
        return {
          id: bot.id,
          type: bot.type,
          enabled: bot.enabled,
          status: status.status,
          lastCheckAt: status.lastCheckAt,
          lastAddedCount: status.lastAddedCount,
        };
      })
    );
    return statuses;
  });

  // 정적 파일 서빙 (프론트엔드 빌드 결과물) - 프로덕션 모드에서만
  const distPath = path.join(__dirname, '../dist');
  if (fs.existsSync(distPath)) {
    await fastify.register(fastifyStatic, {
      root: distPath,
      prefix: '/',
    });

    // SPA fallback - API 라우트가 아닌 모든 요청에 index.html 반환
    fastify.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
  }

  return fastify;
}
