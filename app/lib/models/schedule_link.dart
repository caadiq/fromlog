/// 일정 페이지 고정 링크 (투표·스밍 안내 등)
library;

/// 마감이 임박했다고 볼 기간 — 헤더 아이콘에 점을 띄우는 기준 (웹과 동일)
const int kScheduleLinkUrgentDays = 7;

class ScheduleLink {
  final int id;
  final String title;
  final String url;

  /// 'YYYY-MM-DDTHH:mm' 형태의 벽시계 문자열. 기간 제한이 없으면 null.
  /// 서버가 타임존 표기 없이 내려보내므로 그대로 보관한다 — Date로 변환하면 9시간 밀린다.
  final String? endsAt;

  const ScheduleLink({
    required this.id,
    required this.title,
    required this.url,
    this.endsAt,
  });

  factory ScheduleLink.fromJson(Map<String, dynamic> json) => ScheduleLink(
    id: json['id'] as int,
    title: (json['title'] ?? '') as String,
    url: (json['url'] ?? '') as String,
    endsAt: json['endsAt'] as String?,
  );

  /// '~8/16' 마감 배지 문구. 종료일이 없으면 null.
  String? get deadlineLabel {
    final m = RegExp(r'^\d{4}-(\d{2})-(\d{2})').firstMatch(endsAt ?? '');
    if (m == null) return null;
    return '~${int.parse(m.group(1)!)}/${int.parse(m.group(2)!)}';
  }

  /// 마감까지 [kScheduleLinkUrgentDays] 이내인가 (종료일 없으면 false)
  bool get isUrgent {
    if (endsAt == null) return false;
    final end = DateTime.tryParse(endsAt!); // 타임존 없는 문자열 → 로컬 시각
    if (end == null) return false;
    final left = end.difference(DateTime.now());
    return !left.isNegative && left.inDays <= kScheduleLinkUrgentDays;
  }
}
