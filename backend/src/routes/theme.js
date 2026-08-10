import { errorResponse } from '../schemas/index.js';
import { logActivity } from '../utils/log.js';
import {
  resolveTheme,
  derivePalette,
  extractThemeColor,
  DEFAULT_PALETTE,
} from '../services/theme.js';

const HEX_PATTERN = '^#([0-9a-fA-F]{6})$';

const paletteProps = {
  mode: { type: 'string' },
  source: { type: 'string' },
  primary: { type: 'string' },
  soft: { type: 'string' },
  deep: { type: 'string' },
  albumId: { type: 'integer', nullable: true },
};

/**
 * 테마 컬러 라우트 (공개 + 관리자)
 */
export default async function themeRoutes(fastify) {
  const { db } = fastify;

  /** GET /api/theme — 현재 적용 팔레트 (공개, 웹·앱 부트스트랩용) */
  fastify.get('/theme', {
    schema: {
      tags: ['theme'],
      summary: '현재 테마 팔레트',
      response: {
        200: { type: 'object', properties: paletteProps },
      },
    },
  }, async () => {
    return resolveTheme(db);
  });

  /** GET /api/admin/theme — 관리자 설정 + 미리보기 */
  fastify.get('/admin/theme', {
    schema: {
      tags: ['admin/theme'],
      summary: '테마 설정 조회',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate],
  }, async () => {
    const resolved = await resolveTheme(db);

    // 수동 설정값
    const [settings] = await db.query(
      "SELECT `key`, `value` FROM app_settings WHERE `key` IN ('theme_mode','theme_manual_color')"
    );
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    const manualColor = map.theme_manual_color || null;

    // 커버가 있는 최신 앨범 (자동 소스)
    const [albums] = await db.query(
      `SELECT id, title, folder_name, cover_thumb_url, theme_color, release_date
         FROM albums
        WHERE cover_medium_url IS NOT NULL
        ORDER BY release_date DESC LIMIT 1`
    );
    const autoAlbum = albums[0] || null;

    return {
      mode: map.theme_mode || 'auto',
      manualColor,
      manualPalette: manualColor ? derivePalette(manualColor) : null,
      autoPalette: autoAlbum?.theme_color
        ? derivePalette(autoAlbum.theme_color)
        : DEFAULT_PALETTE,
      autoAlbum: autoAlbum
        ? {
            id: autoAlbum.id,
            title: autoAlbum.title,
            coverThumbUrl: autoAlbum.cover_thumb_url,
            themeColor: autoAlbum.theme_color,
          }
        : null,
      resolved,
    };
  });

  /** PUT /api/admin/theme — 모드/수동색 저장 */
  fastify.put('/admin/theme', {
    schema: {
      tags: ['admin/theme'],
      summary: '테마 설정 저장',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['mode'],
        properties: {
          mode: { type: 'string', enum: ['auto', 'manual'] },
          manualColor: { type: 'string', pattern: HEX_PATTERN, nullable: true },
        },
      },
      response: {
        200: { type: 'object', properties: paletteProps },
        400: errorResponse,
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { mode } = request.body;
    const manualColor = request.body.manualColor
      ? request.body.manualColor.toUpperCase()
      : null;

    if (mode === 'manual' && !manualColor) {
      return reply.code(400).send({ message: '수동 모드에서는 색상을 지정해야 합니다.' });
    }

    await db.query(
      "UPDATE app_settings SET `value` = ? WHERE `key` = 'theme_mode'",
      [mode]
    );
    await db.query(
      "UPDATE app_settings SET `value` = ? WHERE `key` = 'theme_manual_color'",
      [manualColor]
    );

    logActivity(db, {
      actor: 'admin',
      action: 'update',
      category: 'settings',
      targetType: 'theme',
      summary: mode === 'manual'
        ? `테마 수동 설정: ${manualColor}`
        : '테마 자동 모드로 전환',
    });

    return resolveTheme(db);
  });

  /**
   * POST /api/admin/theme/reextract
   * 커버가 있는데 theme_color가 없는(또는 전체) 앨범을 재추출해 백필.
   * body: { all?: boolean } — all이면 커버 있는 모든 앨범 재추출
   */
  fastify.post('/admin/theme/reextract', {
    schema: {
      tags: ['admin/theme'],
      summary: '앨범 대표색 재추출(백필)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: { all: { type: 'boolean' } },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const all = request.body?.all === true;
    const [albums] = await db.query(
      `SELECT id, cover_original_url FROM albums
        WHERE cover_original_url IS NOT NULL
        ${all ? '' : 'AND theme_color IS NULL'}`
    );

    let updated = 0;
    const failed = [];
    for (const album of albums) {
      try {
        const res = await fetch(album.cover_original_url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const color = await extractThemeColor(buf);
        if (color) {
          await db.query('UPDATE albums SET theme_color = ? WHERE id = ?', [color, album.id]);
          updated += 1;
        }
      } catch (err) {
        failed.push({ id: album.id, error: err.message });
      }
    }

    return { total: albums.length, updated, failed };
  });
}
