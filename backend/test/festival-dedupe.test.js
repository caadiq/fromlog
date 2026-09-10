/**
 * 수집 큐 중복 판정 — 실제로 겪은 제목들로 못 박는다.
 *
 * 종전 규칙은 "같은 날짜 + 같은 카테고리"면 무조건 중복 의심이었다.
 * 축제철에는 하루에 여러 학교가 겹치는 게 정상이라, 가천대 축제에
 * 인하대 비룡제가 중복으로 붙었다(이 규칙이 낸 힌트는 그 오탐 한 건뿐이었다).
 *
 * 반대로 글자 유사도로 바꾸면 "인하대학교 축제" ↔ "인하대학교 2026 비룡제"가
 * 0.32로 갈라져 진짜 중복을 놓친다. 그래서 고유 낱말이 겹치는지로 본다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { findExistingMatch, distinctiveTokens } from '../src/services/festival/dedupe.js';

const 기존 = [
  { date: '2026-09-16', category: '행사', title: '인하대학교 2026 비룡제 : 「BLUE SAGA」' },
  { date: '2026-05-06', category: '행사', title: '우송대학교 ONE CITY FESTIVAL' },
  { date: '2026-05-14', category: '행사', title: '명지대학교 자연캠퍼스 축제' },
  { date: '2026-09-04', category: '콘서트', title: '2026 fromis_9 ASIA TOUR TOMORROW GLOW.' },
  { date: '2026-08-29', category: '예능', title: '아는 형님' },
  { date: '2026-08-27', category: '기타', title: '뮤지컬 <헬스키친> - 박지원 출연' },
];
const kind = (item) => findExistingMatch(item, 기존)?.kind ?? null;

test('같은 날 다른 학교 축제는 중복이 아니다', () => {
  // 이 버그로 신고가 들어왔다
  assert.equal(kind({ date: '2026-09-16', category: '행사', title: '가천대학교 축제' }), null);
  assert.equal(kind({ date: '2026-05-06', category: '행사', title: '단국대학교 천안캠퍼스 청풍명월' }), null);
  assert.equal(kind({ date: '2026-05-14', category: '행사', title: '숙명여자대학교 축제' }), null);
});

test('명지대와 명지전문대는 다른 학교다', () => {
  assert.equal(kind({ date: '2026-05-14', category: '행사', title: '명지전문대학교 축제' }), null);
});

test('같은 학교면 행사명이 달라도 의심으로 잡는다', () => {
  // 글자 유사도(0.32)로는 못 잡던 진짜 중복
  assert.equal(kind({ date: '2026-09-16', category: '행사', title: '인하대학교 축제' }), 'suspect');
});

test('제목이 서로를 포함하면 확실한 중복이라 건너뛴다', () => {
  assert.equal(kind({ date: '2026-08-27', category: '기타', title: '뮤지컬 헬스키친' }), 'exact');
});

test('짧은 제목은 똑같아도 건너뛰지 않고 사람에게 묻는다', () => {
  // '아는 형님'은 4글자라 MIN_TITLE_CHARS(7) 아래다. 짧은 제목은 우연히 겹치기 쉬워
  // 조용히 건너뛰면 진짜 새 일정을 잃을 수 있으므로 의심으로만 표시한다.
  assert.equal(kind({ date: '2026-08-29', category: '예능', title: '아는 형님' }), 'suspect');
});

test('오타가 있어도 고유 낱말이 겹치면 의심으로 잡는다', () => {
  assert.equal(
    kind({ date: '2026-09-04', category: '콘서트', title: 'ASIA TOUR TOMRROW GLOW. 1일차' }),
    'suspect',
  );
});

test('날짜나 카테고리가 다르면 아예 보지 않는다', () => {
  assert.equal(kind({ date: '2026-09-17', category: '행사', title: '인하대학교 축제' }), null);
  assert.equal(kind({ date: '2026-09-16', category: '기타', title: '인하대학교 축제' }), null);
  assert.equal(kind({ category: '행사', title: '인하대학교 축제' }), null); // 날짜 미정
});

test('흔한 낱말은 고유 낱말로 치지 않는다', () => {
  const t = distinctiveTokens('가천대학교 축제');
  assert.ok(t.has('가천'), '학교명은 접미사를 뗀 형태도 담는다');
  assert.ok(!t.has('축제'));
  assert.ok(!t.has('대학교'));
  assert.ok(!distinctiveTokens('2026 fromis_9 콘서트').has('2026'), '연도 숫자는 뺀다');
});
