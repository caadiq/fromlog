/**
 * 초성 변환/검색 모듈
 * 한글 텍스트를 초성으로 변환하고 초성 검색 지원
 */

// 초성 목록 (유니코드 순서)
const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

// 한글 유니코드 범위
const HANGUL_START = 0xAC00;
const HANGUL_END = 0xD7A3;

/**
 * 문자가 한글인지 확인
 */
function isHangul(char) {
  const code = char.charCodeAt(0);
  return code >= HANGUL_START && code <= HANGUL_END;
}

/**
 * 문자가 초성인지 확인
 */
function isChosung(char) {
  return CHOSUNG.includes(char);
}

/**
 * 한글 텍스트를 초성으로 변환
 * @param {string} text - 변환할 텍스트
 * @returns {string} - 초성 문자열
 * @example "프로미스나인" → "ㅍㄹㅁㅅㄴㅇ"
 */
export function getChosung(text) {
  if (!text) return '';

  let result = '';
  for (const char of text) {
    if (isHangul(char)) {
      const code = char.charCodeAt(0) - HANGUL_START;
      const chosungIndex = Math.floor(code / 588);
      result += CHOSUNG[chosungIndex];
    } else if (isChosung(char)) {
      // 이미 초성이면 그대로
      result += char;
    }
    // 한글이 아닌 문자는 무시
  }
  return result;
}

/**
 * 입력이 초성으로만 구성되어 있는지 확인
 * @param {string} text - 확인할 텍스트
 * @returns {boolean}
 */
export function isChosungOnly(text) {
  if (!text) return false;
  for (const char of text) {
    if (!isChosung(char) && char !== ' ') {
      return false;
    }
  }
  return true;
}

/**
 * 초성 패턴이 단어와 매칭되는지 확인
 * @param {string} chosung - 초성 패턴
 * @param {string} word - 비교할 단어
 * @returns {boolean}
 * @example isChosungMatch("ㅍㄹㅁ", "프로미스") → true
 */
export function isChosungMatch(chosung, word) {
  const wordChosung = getChosung(word);
  return wordChosung.startsWith(chosung);
}
