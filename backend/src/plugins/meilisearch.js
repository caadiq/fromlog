import fp from 'fastify-plugin';
import { MeiliSearch } from 'meilisearch';

const INDEX_NAME = 'schedules';

async function meilisearchPlugin(fastify, opts) {
  const { host, apiKey } = fastify.config.meilisearch;

  const client = new MeiliSearch({
    host,
    apiKey,
  });

  // 연결 테스트 및 인덱스 초기화
  try {
    await client.health();
    fastify.log.info('Meilisearch 연결 성공');

    // 인덱스 초기화
    await initIndex(client, fastify.log);
  } catch (err) {
    fastify.log.error('Meilisearch 연결 실패:', err.message);
    // Meilisearch가 없어도 서버는 동작하도록 에러를 던지지 않음
  }

  fastify.decorate('meilisearch', client);
  fastify.decorate('meilisearchIndex', INDEX_NAME);
}

/**
 * 인덱스 초기화 및 설정
 */
async function initIndex(client, log) {
  try {
    // 인덱스 생성 (이미 존재하면 무시)
    try {
      await client.createIndex(INDEX_NAME, { primaryKey: 'id' });
    } catch (err) {
      // 이미 존재하는 경우 무시
    }

    const index = client.index(INDEX_NAME);

    // 검색 가능한 필드 설정 (순서가 우선순위 결정)
    await index.updateSearchableAttributes([
      'title',
      'description',
      'source_name',
      'category_name',
    ]);

    // 필터링 가능한 필드 설정
    await index.updateFilterableAttributes(['category_id', 'date']);

    // 정렬 가능한 필드 설정
    await index.updateSortableAttributes(['date', 'time']);

    // 랭킹 규칙 설정 (동일 유사도일 때 최신 날짜 우선)
    await index.updateRankingRules([
      'words',
      'typo',
      'proximity',
      'attribute',
      'exactness',
      'date:desc',
    ]);

    // 오타 허용 설정
    await index.updateTypoTolerance({
      enabled: true,
      minWordSizeForTypos: {
        oneTypo: 2,
        twoTypos: 4,
      },
    });

    // 페이징 설정
    await index.updatePagination({
      maxTotalHits: 10000,
    });

    log.info('Meilisearch 인덱스 초기화 완료');
  } catch (err) {
    log.error('Meilisearch 인덱스 초기화 오류:', err.message);
  }
}

export default fp(meilisearchPlugin, {
  name: 'meilisearch',
  dependencies: ['db'],
});
