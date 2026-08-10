import { uploadMemberImage } from '../../services/image.js';
import { getAllMembers, getMemberByName, getMemberBasicByName, invalidateMemberCache } from '../../services/member.js';
import { notFound, serverError } from '../../utils/error.js';
import { logActivity } from '../../utils/log.js';

/**
 * 멤버 라우트
 * GET: 공개, PUT: 인증 필요
 */
export default async function membersRoutes(fastify, opts) {
  const { db, redis } = fastify;

  /**
   * GET /api/members
   * 전체 멤버 목록 조회 (공개, 캐시 적용)
   */
  fastify.get('/', {
    schema: {
      tags: ['members'],
      summary: '전체 멤버 목록 조회',
    },
  }, async (request, reply) => {
    try {
      return await getAllMembers(db, redis);
    } catch (err) {
      fastify.log.error(err);
      return serverError(reply, '멤버 목록 조회 실패');
    }
  });

  /**
   * GET /api/members/:name
   * 멤버 상세 조회 (공개)
   */
  fastify.get('/:name', {
    schema: {
      tags: ['members'],
      summary: '멤버 상세 조회',
      params: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '멤버 이름' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const member = await getMemberByName(db, decodeURIComponent(request.params.name));
      if (!member) {
        return notFound(reply, '멤버를 찾을 수 없습니다');
      }
      return member;
    } catch (err) {
      fastify.log.error(err);
      return serverError(reply, '멤버 조회 실패');
    }
  });

  /**
   * GET /api/members/:name/photos
   * 멤버가 태깅된 컨셉 포토 (최신 앨범순 — 멤버 상세 RECENT PHOTOS)
   */
  fastify.get('/:name/photos', {
    schema: {
      tags: ['members'],
      summary: '멤버 태깅 컨셉 포토',
      params: {
        type: 'object',
        properties: { name: { type: 'string' } },
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 8 },
          all: { type: 'string', description: "'1'이면 단체 포함 전체" },
        },
      },
    },
  }, async (request, reply) => {
    const member = await getMemberByName(db, decodeURIComponent(request.params.name));
    if (!member) {
      return notFound(reply, '멤버를 찾을 수 없습니다');
    }
    const all = request.query.all === '1' || request.query.all === 'true';
    const limit = all ? 500 : Math.min(parseInt(request.query.limit) || 8, 30);
    // all 모드: 태깅된 사진(개인·유닛) + 모든 단체 사진(단체는 전원 포함)
    const [photos] = await db.query(
      `SELECT DISTINCT p.id, p.medium_url, p.thumb_url, p.concept_name, p.photo_type,
              p.width, p.height,
              a.title AS album_title, a.folder_name AS album_folder, a.release_date
       FROM album_photos p
       JOIN albums a ON p.album_id = a.id
       LEFT JOIN album_photo_members pm ON pm.photo_id = p.id AND pm.member_id = ?
       WHERE pm.id IS NOT NULL ${all ? "OR p.photo_type = 'group'" : ''}
       ORDER BY a.release_date DESC, p.sort_order ASC
       LIMIT ?`,
      [member.id, limit]
    );
    return { photos };
  });

  /**
   * PUT /api/members/:name
   * 멤버 수정 (인증 필요)
   */
  fastify.put('/:name', {
    schema: {
      tags: ['members'],
      summary: '멤버 수정',
      description: 'multipart/form-data로 이미지와 정보를 함께 전송',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '멤버 이름' },
        },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { name } = request.params;
    const decodedName = decodeURIComponent(name);

    try {
      // 기존 멤버 조회
      const existing = await getMemberBasicByName(db, decodedName);
      if (!existing) {
        return notFound(reply, '멤버를 찾을 수 없습니다');
      }

      const memberId = existing.id;
      let imageId = existing.image_id;

      // multipart 데이터 파싱
      const parts = request.parts();
      const fields = {};
      let imageBuffer = null;

      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'image') {
          // 이미지 파일
          const chunks = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          imageBuffer = Buffer.concat(chunks);
        } else if (part.type === 'field') {
          // 일반 필드
          fields[part.fieldname] = part.value;
        }
      }

      // 새 이미지가 있으면 업로드
      if (imageBuffer && imageBuffer.length > 0) {
        const newName = fields.name || decodedName;
        const { originalUrl, mediumUrl, thumbUrl } = await uploadMemberImage(newName, imageBuffer);

        // images 테이블에 저장
        const [result] = await db.query(
          'INSERT INTO images (original_url, medium_url, thumb_url) VALUES (?, ?, ?)',
          [originalUrl, mediumUrl, thumbUrl]
        );
        imageId = result.insertId;
      }

      // 멤버 정보 업데이트
      await db.query(`
        UPDATE members SET
          name = ?,
          name_en = ?,
          birth_date = ?,
          instagram = ?,
          image_id = ?,
          is_former = ?
        WHERE id = ?
      `, [
        fields.name || decodedName,
        fields.name_en || null,
        fields.birth_date || null,
        fields.instagram || null,
        imageId,
        fields.is_former === 'true' || fields.is_former === '1' ? 1 : 0,
        memberId,
      ]);

      // 별명 업데이트 (기존 삭제 후 새로 추가)
      if (fields.nicknames) {
        await db.query(
          'DELETE FROM member_nicknames WHERE member_id = ?',
          [memberId]
        );

        const nicknames = JSON.parse(fields.nicknames);
        if (nicknames.length > 0) {
          const values = nicknames.map(n => [memberId, n]);
          await db.query(
            'INSERT INTO member_nicknames (member_id, nickname) VALUES ?',
            [values]
          );
        }
      }

      // 멤버 캐시 무효화
      await invalidateMemberCache(redis);

      logActivity(db, { actor: 'admin', action: 'update', category: 'member', targetType: 'member', targetId: memberId, summary: `멤버 수정: ${fields.name || decodedName}` });
      return { message: '멤버 정보가 수정되었습니다', id: memberId };
    } catch (err) {
      fastify.log.error(err);
      return serverError(reply, '멤버 수정 실패: ' + err.message);
    }
  });
}
