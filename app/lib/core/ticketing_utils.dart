/// 티켓팅 상세의 순수 로직 (날짜 파싱·D-day·단계/인증 상태 계산).
/// 위젯에서 분리해 단독 테스트가 가능하도록 core로 뺐다.
library;

import 'format_utils.dart';

const ticketingStageLabel = {'presale': '팬클럽 선예매', 'general': '일반예매'};

/// 'YYYY-MM-DD' + 'HH:mm[:ss]' → DateTime (time 없으면 자정)
DateTime? ticketingToDate(String? date, String? time) {
  if (date == null) return null;
  final hm = time != null && time.length >= 5 ? time.substring(0, 5) : '00:00';
  return DateTime.tryParse('${date}T$hm:00');
}

/// "M. D. (요일) HH:mm" (time 없으면 시각 생략)
String ticketingFmt(String? date, String? time) {
  final d = ticketingToDate(date, time);
  if (d == null) return '';
  final base = '${d.month}. ${d.day}. (${weekdayKo(d)})';
  return time != null ? '$base ${time.substring(0, 5)}' : base;
}

/// (label, kind) — kind: 'done' | 'now' | 'todo'
(String, String)? ticketingStageStatus(String? date, String? time) {
  final d = ticketingToDate(date, time);
  if (d == null) return null;
  final now = DateTime.now();
  if (d.year == now.year && d.month == now.month && d.day == now.day) {
    return ('D-DAY', 'now');
  }
  if (d.isBefore(now)) return ('종료', 'done');
  final days = DateTime(d.year, d.month, d.day)
      .difference(DateTime(now.year, now.month, now.day))
      .inDays;
  return ('D-$days', 'todo');
}

/// 인증 기간 상태 (start~end 대비 현재)
(String, String) ticketingAuthStatus(String? start, String? end) {
  final now = DateTime.now();
  final s = start != null ? DateTime.tryParse(start.replaceFirst(' ', 'T')) : null;
  final e = end != null ? DateTime.tryParse(end.replaceFirst(' ', 'T')) : null;
  if (e != null && now.isAfter(e)) return ('종료', 'done');
  if (s != null && now.isBefore(s)) return ('예정', 'todo');
  return ('진행 중', 'now');
}

/// 'YYYY-MM-DD HH:mm...' → "M. D. (요일) HH:mm"
String ticketingFmtAuth(String? dt) {
  if (dt == null || dt.length < 16) return '';
  return ticketingFmt(dt.substring(0, 10), dt.substring(11, 16));
}
