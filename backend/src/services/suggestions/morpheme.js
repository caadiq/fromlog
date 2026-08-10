/**
 * 형태소 분석 모듈 (kiwi-nlp)
 * 검색어에서 명사(NNG, NNP, SL)만 추출
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('Morpheme');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let kiwi = null;
let isInitialized = false;
let initPromise = null;

// 추출 대상 품사 태그 (세종 품사 태그)
const NOUN_TAGS = [
  'NNG',  // 일반명사
  'NNP',  // 고유명사
  'NNB',  // 의존명사
  'NR',   // 수사
  'SL',   // 외국어
  'SH',   // 한자
];

// 모델 파일 목록
const MODEL_FILES = [
  'combiningRule.txt',
  'default.dict',
  'dialect.dict',
  'extract.mdl',
  'multi.dict',
  'sj.morph',
  'typo.dict',
  'cong.mdl',
];

// 사용자 사전 파일
const USER_DICT = 'user.dict';

/**
 * kiwi-nlp 초기화 (한 번만 실행)
 */
export async function initMorpheme() {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      logger.info('kiwi-nlp 초기화 시작...');

      // kiwi-nlp 동적 import (ESM)
      const { KiwiBuilder } = await import('kiwi-nlp');

      // wasm 파일 경로
      const wasmPath = join(__dirname, '../../../node_modules/kiwi-nlp/dist/kiwi-wasm.wasm');

      // 모델 파일 경로
      const modelDir = join(__dirname, '../../../models/kiwi/models/cong/base');
      const userDictPath = join(__dirname, '../../../models/kiwi', USER_DICT);

      // KiwiBuilder 생성
      const builder = await KiwiBuilder.create(wasmPath);

      // 모델 파일 로드
      const modelFiles = {};
      for (const filename of MODEL_FILES) {
        const filepath = join(modelDir, filename);
        try {
          modelFiles[filename] = new Uint8Array(readFileSync(filepath));
        } catch (err) {
          logger.warn(`모델 파일 로드 실패: ${filename}`);
        }
      }

      // 사용자 사전 로드
      let userDicts = [];
      try {
        modelFiles[USER_DICT] = new Uint8Array(readFileSync(userDictPath));
        userDicts = [USER_DICT];
        logger.info('사용자 사전 로드 완료');
      } catch (err) {
        logger.warn('사용자 사전 없음, 기본 사전만 사용');
      }

      // Kiwi 인스턴스 생성
      kiwi = await builder.build({ modelFiles, userDicts });

      isInitialized = true;
      logger.info('kiwi-nlp 초기화 완료');
    } catch (error) {
      logger.error(`초기화 실패: ${error.message}`);
      // 초기화 실패해도 서비스는 계속 동작 (fallback 사용)
    }
  })();

  return initPromise;
}

/**
 * 텍스트에서 명사 추출
 * @param {string} text - 분석할 텍스트
 * @returns {Promise<string[]>} - 추출된 명사 배열
 */
export async function extractNouns(text) {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // 초기화 확인
  if (!isInitialized) {
    await initMorpheme();
  }

  // kiwi가 초기화되지 않았으면 fallback
  if (!kiwi) {
    logger.warn('kiwi 미초기화, fallback 사용');
    return fallbackExtract(text);
  }

  try {
    // 형태소 분석 실행
    const result = kiwi.analyze(text);
    const nouns = [];

    // 분석 결과에서 명사만 추출
    // result 구조: { score: number, tokens: Array<{str, tag, start, len}> }
    if (result && result.tokens) {
      for (const token of result.tokens) {
        const tag = token.tag;
        const surface = token.str;

        if (NOUN_TAGS.includes(tag) && surface.length > 0) {
          const normalized = surface.trim().toLowerCase();
          if (!nouns.includes(normalized)) {
            nouns.push(normalized);
          }
        }
      }
    }

    return nouns.length > 0 ? nouns : fallbackExtract(text);
  } catch (error) {
    logger.error(`형태소 분석 오류: ${error.message}`);
    return fallbackExtract(text);
  }
}

/**
 * Fallback: 공백 기준 분리 (형태소 분석 실패 시)
 */
function fallbackExtract(text) {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 0);
}

/**
 * 초기화 상태 확인
 */
export function isReady() {
  return isInitialized && kiwi !== null;
}

/**
 * 형태소 분석기 리로드 (사전 변경 시 호출)
 */
export async function reloadMorpheme() {
  logger.info('리로드 시작...');
  isInitialized = false;
  kiwi = null;
  initPromise = null;
  await initMorpheme();
  logger.info('리로드 완료');
}

/**
 * 사용자 사전 파일 경로 반환
 */
export function getUserDictPath() {
  return join(__dirname, '../../../models/kiwi', USER_DICT);
}
