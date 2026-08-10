/**
 * 추천 검색어 서비스
 * - 형태소 분석으로 명사 추출
 * - Bi-gram 기반 다음 단어 예측
 * - 초성 검색 지원
 * - 영어 오타 감지 (Inko)
 */
import Inko from 'inko';
import { extractNouns, initMorpheme, isReady } from './morpheme.js';
import { getChosung, isChosungOnly, isChosungMatch } from './chosung.js';
import { createLogger } from '../../utils/logger.js';

const inko = new Inko();
const logger = createLogger('Suggestion');

// 설정
const CONFIG = {
  // 추천 검색어 최소 검색 횟수 비율 (최대 대비)
  MIN_COUNT_RATIO: 0.01,
  // 최소 임계값 (데이터 적을 때 오타 방지)
  MIN_COUNT_FLOOR: 10,
  // Redis 키 prefix
  REDIS_PREFIX: 'suggest:',
  // 캐시 TTL (초)
  CACHE_TTL: {
    PREFIX: 3600,      // prefix 검색: 1시간
    BIGRAM: 86400,     // bi-gram: 24시간
    POPULAR: 600,      // 인기 검색어: 10분
  },
};

/**
 * 추천 검색어 서비스 클래스
 */
export class SuggestionService {
  constructor(db, redis) {
    this.db = db;
    this.redis = redis;
  }

  /**
   * 서비스 초기화 (형태소 분석기 로드)
   */
  async initialize() {
    try {
      await initMorpheme();
      logger.info('서비스 초기화 완료');
    } catch (error) {
      logger.error(`서비스 초기화 실패: ${error.message}`);
    }
  }

  /**
   * 영문만 포함된 검색어인지 확인
   */
  isEnglishOnly(text) {
    const englishChars = text.match(/[a-zA-Z]/g) || [];
    const koreanChars = text.match(/[가-힣ㄱ-ㅎㅏ-ㅣ]/g) || [];
    return englishChars.length > 0 && koreanChars.length === 0;
  }

  /**
   * 영어 입력을 한글로 변환 (오타 감지)
   */
  convertEnglishToKorean(text) {
    const converted = inko.en2ko(text);
    return converted !== text ? converted : null;
  }

  /**
   * 검색어 저장 (검색 실행 시 호출)
   * - 형태소 분석으로 명사 추출
   * - Unigram + Bi-gram 저장
   */
  async saveSearchQuery(query) {
    if (!query || query.trim().length === 0) return;

    let normalizedQuery = query.trim().toLowerCase();

    // 영어 입력 → 한글 변환 시도
    if (this.isEnglishOnly(normalizedQuery)) {
      const korean = this.convertEnglishToKorean(normalizedQuery);
      if (korean) {
        logger.debug(`한글 변환: "${normalizedQuery}" → "${korean}"`);
        normalizedQuery = korean;
      }
    }

    try {
      // 1. 전체 검색어 저장 (Unigram)
      await this.db.query(
        `INSERT INTO suggestion_queries (query, count)
         VALUES (?, 1)
         ON DUPLICATE KEY UPDATE count = count + 1, last_searched_at = CURRENT_TIMESTAMP`,
        [normalizedQuery]
      );

      // 2. 형태소 분석으로 명사 추출
      let nouns;
      if (isReady()) {
        nouns = await extractNouns(normalizedQuery);
      } else {
        // fallback: 공백 분리
        nouns = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
      }

      // 3. Bi-gram 저장 (명사 쌍)
      for (let i = 0; i < nouns.length - 1; i++) {
        const word1 = nouns[i].toLowerCase();
        const word2 = nouns[i + 1].toLowerCase();

        await this.db.query(
          `INSERT INTO suggestion_word_pairs (word1, word2, count)
           VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE count = count + 1`,
          [word1, word2]
        );

        // Redis 캐시 업데이트
        await this.redis.zincrby(`${CONFIG.REDIS_PREFIX}bigram:${word1}`, 1, word2);
      }

      // 4. 초성 인덱스 저장
      for (const noun of nouns) {
        const chosung = getChosung(noun);
        if (chosung.length >= 2) {
          await this.db.query(
            `INSERT INTO suggestion_chosung (chosung, word, count)
             VALUES (?, ?, 1)
             ON DUPLICATE KEY UPDATE count = count + 1`,
            [chosung, noun.toLowerCase()]
          );
        }
      }

      logger.debug(`저장: "${normalizedQuery}" → 명사: [${nouns.join(', ')}]`);
    } catch (error) {
      logger.error(`저장 오류: ${error.message}`);
    }
  }

  /**
   * 추천 검색어 조회
   */
  async getSuggestions(query, limit = 10) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    let searchQuery = query.toLowerCase();
    let koreanQuery = null;

    // 영어 입력 → 한글 변환
    if (this.isEnglishOnly(searchQuery)) {
      koreanQuery = this.convertEnglishToKorean(searchQuery);
    }

    try {
      // 초성 검색 모드
      if (isChosungOnly(searchQuery.replace(/\s/g, ''))) {
        return await this.getChosungSuggestions(searchQuery.replace(/\s/g, ''), limit);
      }

      const endsWithSpace = query.endsWith(' ');
      const words = searchQuery.trim().split(/\s+/).filter(w => w.length > 0);

      if (endsWithSpace && words.length > 0) {
        // 다음 단어 예측 (Bi-gram)
        const lastWord = words[words.length - 1];
        return await this.getNextWordSuggestions(lastWord, searchQuery.trim(), limit);
      } else {
        // Prefix 매칭
        return await this.getPrefixSuggestions(searchQuery.trim(), koreanQuery?.trim(), limit);
      }
    } catch (error) {
      logger.error(`조회 오류: ${error.message}`);
      return [];
    }
  }

  /**
   * 다음 단어 예측 (Bi-gram)
   */
  async getNextWordSuggestions(lastWord, prefix, limit) {
    try {
      // Redis 캐시 확인
      const cacheKey = `${CONFIG.REDIS_PREFIX}bigram:${lastWord}`;
      const cached = await this.redis.zrevrange(cacheKey, 0, limit - 1);

      if (cached && cached.length > 0) {
        return cached.map(word => `${prefix} ${word}`);
      }

      // DB 조회
      const [rows] = await this.db.query(
        `SELECT word2, count FROM suggestion_word_pairs
         WHERE word1 = ?
         ORDER BY count DESC
         LIMIT ?`,
        [lastWord, limit]
      );

      return rows.map(r => `${prefix} ${r.word2}`);
    } catch (error) {
      logger.error(`Bi-gram 조회 오류: ${error.message}`);
      return [];
    }
  }

  /**
   * Prefix 매칭
   * - GREATEST()로 동적 임계값 적용: MAX(count) * 1% 또는 최소 10 중 더 큰 값
   */
  async getPrefixSuggestions(prefix, koreanPrefix, limit) {
    try {
      let rows;

      if (koreanPrefix) {
        // 영어 + 한글 변환 둘 다 검색
        [rows] = await this.db.query(
          `SELECT query FROM suggestion_queries
           WHERE (query LIKE ? OR query LIKE ?)
             AND count >= GREATEST((SELECT MAX(count) * ? FROM suggestion_queries), ?)
           ORDER BY count DESC, last_searched_at DESC
           LIMIT ?`,
          [`${prefix}%`, `${koreanPrefix}%`, CONFIG.MIN_COUNT_RATIO, CONFIG.MIN_COUNT_FLOOR, limit]
        );
      } else {
        [rows] = await this.db.query(
          `SELECT query FROM suggestion_queries
           WHERE query LIKE ?
             AND count >= GREATEST((SELECT MAX(count) * ? FROM suggestion_queries), ?)
           ORDER BY count DESC, last_searched_at DESC
           LIMIT ?`,
          [`${prefix}%`, CONFIG.MIN_COUNT_RATIO, CONFIG.MIN_COUNT_FLOOR, limit]
        );
      }

      return rows.map(r => r.query);
    } catch (error) {
      logger.error(`Prefix 조회 오류: ${error.message}`);
      return [];
    }
  }

  /**
   * 초성 검색
   * - GREATEST()로 동적 임계값 적용
   */
  async getChosungSuggestions(chosung, limit) {
    try {
      const [rows] = await this.db.query(
        `SELECT word FROM suggestion_chosung
         WHERE chosung LIKE ?
           AND count >= GREATEST((SELECT MAX(count) * ? FROM suggestion_chosung), ?)
         ORDER BY count DESC
         LIMIT ?`,
        [`${chosung}%`, CONFIG.MIN_COUNT_RATIO, CONFIG.MIN_COUNT_FLOOR, limit]
      );

      return rows.map(r => r.word);
    } catch (error) {
      logger.error(`초성 검색 오류: ${error.message}`);
      return [];
    }
  }

  /**
   * 인기 검색어 조회
   * - GREATEST()로 동적 임계값 적용
   */
  async getPopularQueries(limit = 10) {
    try {
      // Redis 캐시 확인
      const cacheKey = `${CONFIG.REDIS_PREFIX}popular`;
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // DB 조회 (동적 임계값 이상만)
      const [rows] = await this.db.query(
        `SELECT query FROM suggestion_queries
         WHERE count >= GREATEST((SELECT MAX(count) * ? FROM suggestion_queries), ?)
         ORDER BY count DESC
         LIMIT ?`,
        [CONFIG.MIN_COUNT_RATIO, CONFIG.MIN_COUNT_FLOOR, limit]
      );

      const result = rows.map(r => r.query);

      // 캐시 저장
      await this.redis.setex(cacheKey, CONFIG.CACHE_TTL.POPULAR, JSON.stringify(result));

      return result;
    } catch (error) {
      logger.error(`인기 검색어 조회 오류: ${error.message}`);
      return [];
    }
  }
}

export default SuggestionService;
