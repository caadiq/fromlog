/// 공용 포맷 유틸 (날짜·시간·요일·HTML 디코딩·색상 파싱)
///
/// 여러 화면에 흩어져 있던 중복 구현을 통합한 단일 소스.
library;

import 'package:flutter/material.dart';

import 'constants.dart';

/// 요일 이름 (일요일 시작 — DateTime.weekday % 7 로 인덱싱)
const List<String> weekdaysKo = ['일', '월', '화', '수', '목', '금', '토'];

/// 요일 전체 이름 (일정 헤더 등)
const List<String> weekdaysKoFull = [
  '일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일',
];

/// DateTime → 요일 한 글자
String weekdayKo(DateTime date) => weekdaysKo[date.weekday % 7];

/// "2026. 1. 18. (일)" — 웹 formatFullDate와 동일
String formatFullDate(String dateStr) {
  final d = DateTime.parse(dateStr);
  return '${d.year}. ${d.month}. ${d.day}. (${weekdayKo(d)})';
}

/// "HH:mm" (뒤 초 단위 제거). null 허용.
String? formatHm(String? time) {
  if (time == null) return null;
  return time.length >= 5 ? time.substring(0, 5) : time;
}

/// 'YYYY-MM-DD' 또는 'YYYY-MM-DDT…' → DateTime (날짜만, 실패·null 시 null)
/// API의 date 필드가 ISO(T 포함)로 올 수도, 날짜만 올 수도 있어 T 앞만 파싱한다.
DateTime? parseDate(String? s) {
  if (s == null) return null;
  return DateTime.tryParse(s.split('T')[0]);
}

/// HTML 엔티티 디코딩
String decodeHtmlEntities(String text) {
  return text
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&nbsp;', ' ');
}

/// 카테고리 색상 파싱 ("#RRGGBB" → Color, 실패 시 textTertiary)
/// '#RRGGBB' → Color (앱 공용 헥사 파서). null·빈값·파싱실패 시 null.
Color? parseHexColorOrNull(String? colorStr) {
  if (colorStr == null || colorStr.isEmpty) return null;
  try {
    final hex = colorStr.replaceFirst('#', '');
    return Color(int.parse('FF$hex', radix: 16));
  } catch (_) {
    return null;
  }
}

/// '#RRGGBB' → Color. 실패 시 fallback(기본 EColors.mute).
Color parseColor(String? colorStr, {Color fallback = EColors.mute}) {
  return parseHexColorOrNull(colorStr) ?? fallback;
}

/// 요일 약어 (영문 대문자) — 일정 날짜 스트립·검색용
const List<String> weekdaysEn = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const List<String> weekdaysEnFull = [
  'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY',
];

/// 영상 길이(초) → "M:SS" / 1시간 이상이면 "H:MM:SS" — 웹 formatVideoDuration과 동일
/// 값이 없으면 빈 문자열 (호출부에서 배지를 그리지 않는다)
String formatVideoDuration(int? seconds) {
  if (seconds == null || seconds <= 0) return '';
  final h = seconds ~/ 3600;
  final m = (seconds % 3600) ~/ 60;
  final s = seconds % 60;
  final ss = s.toString().padLeft(2, '0');
  return h > 0 ? '$h:${m.toString().padLeft(2, '0')}:$ss' : '$m:$ss';
}

/// 안내(공지) 일정인지 판별 — 웹 utils/schedule.js `isNoticeSchedule`과 동일 규칙.
///
/// X 일정 제목은 트윗 첫 문단을 그대로 가져오는데, 소스 계정이 표식을 붙이는
/// 관습이 있다(💌 소식 · 📺 영상 · 💡 편성 · 📢 안내). 이 중 📢만 팬이 실제로
/// 행동해야 하는 안내(인원체크·재모임·사전판매 등)라 목록에서 강조한다.
///
/// 위치는 따지지 않는다 — `[📢] …`, `📢 …`, `… NOTICE 📢`, 리트윗 본문까지
/// 실제 데이터에서 전부 안내였다. 카테고리는 X로 한정한다.
bool isNoticeSchedule({int? categoryId, String? title}) =>
    categoryId == CategoryId.x && (title ?? '').contains('📢');
