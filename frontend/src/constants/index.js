/**
 * 상수 정의
 */

/** 공식 SNS 링크 */
export const SOCIAL_LINKS = {
  youtube: 'https://www.youtube.com/@fromis9_official',
  instagram: 'https://www.instagram.com/officialfromis_9',
  x: 'https://twitter.com/realfromis_9',
};

/** 타임존 */
export const TIMEZONE = 'Asia/Seoul';

/** 요일 이름 (짧은 형태) */
export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 요일 이름 (긴 형태) */
export const WEEKDAYS_LONG = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

/**
 * 일정 카테고리 ID (백엔드 config/index.js CATEGORY_IDS와 동일)
 * 백엔드에 종속된 매직넘버를 화면 곳곳에 흩지 않기 위한 단일 소스.
 */
export const CATEGORY_IDS = {
  YOUTUBE: 2,
  X: 3,
  COMEBACK: 4,
  FANSIGN: 5,
  CONCERT: 6,
  TICKETING: 7,
  BIRTHDAY: 8,
  ANNIVERSARY: 9,
  VARIETY: 10,
  EVENT: 11,
  ALBUM: 17,
};

/** 컴백·앨범 일정은 목록 상단에 항상 노출 */
export const FEATURED_CATEGORY_IDS = [CATEGORY_IDS.COMEBACK, CATEGORY_IDS.ALBUM];

/** 목록에서 눌렀을 때 상세 페이지로 이동하는 카테고리 (유튜브·X·콘서트) */
export const DETAIL_NAV_CATEGORY_IDS = [
  CATEGORY_IDS.YOUTUBE,
  CATEGORY_IDS.X,
  CATEGORY_IDS.CONCERT,
];

/** 검색 결과 페이지 크기 */
export const SEARCH_LIMIT = 20;

/** 캘린더 최소 년도 */
export const MIN_YEAR = 2017;

/** 월 이름 */
export const MONTH_NAMES = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월',
];

/** 컨셉 포토 타입 라벨 (단체·유닛·개인) */
export const TYPE_LABEL = { group: '단체', unit: '유닛', solo: '개인' };

/** 그룹 정보 */
export const GROUP_INFO = {
  NAME: 'fromis_9',
  NAME_KR: '프로미스나인',
  DEBUT_DATE: '2018-01-24',
  DEBUT_DATE_DISPLAY: '2018.01.24',
  FANDOM_NAME: 'flover',
};
