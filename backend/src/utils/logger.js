/**
 * 로거 유틸리티
 * 서비스 레이어에서 사용할 수 있는 간단한 로깅 유틸리티
 */
import { nowKST } from './date.js';

const PREFIX = {
  info: '[INFO]',
  warn: '[WARN]',
  error: '[ERROR]',
  debug: '[DEBUG]',
};

function formatMessage(level, context, message) {
  const timestamp = nowKST();
  return `${timestamp} ${PREFIX[level]} [${context}] ${message}`;
}

/**
 * 로거 생성
 * @param {string} context - 로깅 컨텍스트 (예: 'Meilisearch', 'Suggestions')
 * @returns {object} 로거 객체
 */
export function createLogger(context) {
  return {
    info: (message, ...args) => {
      console.log(formatMessage('info', context, message), ...args);
    },
    warn: (message, ...args) => {
      console.warn(formatMessage('warn', context, message), ...args);
    },
    error: (message, ...args) => {
      console.error(formatMessage('error', context, message), ...args);
    },
    debug: (message, ...args) => {
      if (process.env.DEBUG) {
        console.debug(formatMessage('debug', context, message), ...args);
      }
    },
  };
}

// 기본 로거 (컨텍스트 없음)
export default createLogger('App');
