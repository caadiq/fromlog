import authRoutes from './auth.js';
import membersRoutes from './members/index.js';
import albumsRoutes from './albums/index.js';
import schedulesRoutes from './schedules/index.js';
import statsRoutes from './stats/index.js';
import videosRoutes from './videos.js';
import pushRoutes from './push.js';
import botsRoutes from './admin/bots.js';
import youtubeBotsRoutes from './admin/youtube-bots.js';
import xBotsRoutes from './admin/x-bots.js';
import festivalBotsRoutes from './admin/festival-bots.js';
import youtubeAdminRoutes from './admin/youtube.js';
import videosAdminRoutes from './admin/videos.js';
import xAdminRoutes from './admin/x.js';
import concertAdminRoutes from './admin/concert.js';
import eventsAdminRoutes from './admin/events.js';
import etcAdminRoutes from './admin/etc.js';
import pendingAdminRoutes from './admin/pending.js';
import varietyAdminRoutes from './admin/variety.js';
import schedulesAdminRoutes from './admin/schedules.js';
import fansignAdminRoutes from './admin/fansign.js';
import ticketingAdminRoutes from './admin/ticketing.js';
import placesAdminRoutes from './admin/places.js';
import logsAdminRoutes from './admin/logs.js';
import scheduleCategoriesAdminRoutes from './admin/schedule-categories.js';
import themeRoutes from './theme.js';

/**
 * 라우트 통합
 * /api/*
 */
export default async function routes(fastify) {
  // 인증 라우트
  fastify.register(authRoutes, { prefix: '/auth' });

  // 멤버 라우트
  fastify.register(membersRoutes, { prefix: '/members' });

  // 앨범 라우트
  fastify.register(albumsRoutes, { prefix: '/albums' });

  // 일정 라우트
  fastify.register(schedulesRoutes, { prefix: '/schedules' });

  // 통계 라우트
  fastify.register(statsRoutes, { prefix: '/stats' });

  // 영상 아카이브 라우트
  fastify.register(videosRoutes, { prefix: '/videos' });

  // 푸시 알림 라우트
  fastify.register(pushRoutes, { prefix: '/push' });

  // 관리자 - 봇 라우트
  fastify.register(botsRoutes, { prefix: '/admin/bots' });

  // 관리자 - YouTube 봇 라우트
  fastify.register(youtubeBotsRoutes, { prefix: '/admin/youtube-bots' });

  // 관리자 - X 봇 라우트
  fastify.register(xBotsRoutes, { prefix: '/admin/x-bots' });

  // 관리자 - 축제 봇 라우트
  fastify.register(festivalBotsRoutes, { prefix: '/admin/festival-bots' });

  // 관리자 - YouTube 라우트
  fastify.register(youtubeAdminRoutes, { prefix: '/admin/youtube' });

  // 영상 아카이브 관리
  fastify.register(videosAdminRoutes, { prefix: '/admin/videos' });

  // 관리자 - X 라우트
  fastify.register(xAdminRoutes, { prefix: '/admin/x' });

  // 관리자 - 콘서트 라우트
  fastify.register(concertAdminRoutes, { prefix: '/admin/concert' });

  // 관리자 - 행사 라우트
  fastify.register(eventsAdminRoutes, { prefix: '/admin/events' });

  // 관리자 - 기타(공용) 라우트
  fastify.register(etcAdminRoutes, { prefix: '/admin/etc' });

  // 관리자 - 수집 큐(검토 대기) 라우트
  fastify.register(pendingAdminRoutes, { prefix: '/admin/pending' });

  // 관리자 - 예능 라우트
  fastify.register(varietyAdminRoutes, { prefix: '/admin/variety' });

  // 관리자 - 일반 일정 라우트 (컴백·팬사인회·기타)
  fastify.register(schedulesAdminRoutes, { prefix: '/admin/schedules' });

  // 관리자 - 팬사인회 라우트
  fastify.register(fansignAdminRoutes, { prefix: '/admin/fansign' });
  fastify.register(ticketingAdminRoutes, { prefix: '/admin/ticketing' });

  // 관리자 - 장소 검색 라우트
  fastify.register(placesAdminRoutes, { prefix: '/admin' });

  // 관리자 - 활동 로그 라우트
  fastify.register(logsAdminRoutes, { prefix: '/admin/logs' });

  // 관리자 - 일정 카테고리 라우트
  fastify.register(scheduleCategoriesAdminRoutes, { prefix: '/admin' });

  // 테마 컬러 (공개 /theme + 관리자 /admin/theme)
  fastify.register(themeRoutes);
}
