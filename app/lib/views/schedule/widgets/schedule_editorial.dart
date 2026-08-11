/// 일정 에디토리얼 위젯 — 특수 카드(생일/데뷔·주년) + 이벤트 행
/// (웹 components/mobile/schedule/*Card.jsx, Schedule.jsx EventRow 대응)
library;

import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../core/constants.dart';
import '../../../core/format_utils.dart';
import '../../../models/schedule.dart';
import '../../../widgets/editorial.dart';

/// hex → rgba
Color _rgba(Color base, double alpha) => base.withValues(alpha: alpha);

/// 일반 이벤트 행 — 시각 | 제목/출처 | 카테고리명
class EventRow extends StatelessWidget {
  final Schedule schedule;
  final VoidCallback onTap;
  final bool dashed;
  final String? subtitleOverride;

  EventRow({
    super.key,
    required this.schedule,
    required this.onTap,
    this.dashed = false,
    this.subtitleOverride,
  });

  @override
  Widget build(BuildContext context) {
    final time = formatHm(schedule.time);
    final subtitle = subtitleOverride ?? schedule.sourceName;
    final color = parseColor(schedule.categoryColor);
    // 안내(📢) 일정은 시각·제목을 테마색으로 물들여 훑을 때 바로 잡히게 한다 (웹과 동일)
    final notice = isNoticeSchedule(
      categoryId: schedule.categoryId,
      title: schedule.title,
    );

    final row = Padding(
      padding: EdgeInsets.symmetric(horizontal: 2, vertical: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          SizedBox(
            width: 46,
            child: Text(
              time ?? '--:--',
              style: TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w800,
                color: notice
                    ? noticeColor
                    : (time != null ? EColors.ink : EColors.faint),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  decodeHtmlEntities(schedule.title),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 15.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.2,
                    color: notice ? noticeColor : EColors.ink,
                  ),
                ),
                if (subtitle != null && subtitle.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13, color: EColors.mute),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Text(
            schedule.categoryName ?? '',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.3,
              color: color,
            ),
          ),
        ],
      ),
    );

    return InkWell(
      onTap: onTap,
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(
            bottom: dashed
                ? const BorderSide(color: EColors.faintLight, width: 1)
                : const BorderSide(color: EColors.hairline, width: 1),
          ),
        ),
        child: dashed ? _DashedBottom(child: row) : row,
      ),
    );
  }
}

/// 점선 하단 보더 래퍼
class _DashedBottom extends StatelessWidget {
  final Widget child;
  _DashedBottom({required this.child});

  @override
  Widget build(BuildContext context) {
    return Column(children: [child, const DashedLine()]);
  }
}


/// 생일 카드 — 핑크 그라디언트 + 이름 강조
class EBirthdayCard extends StatelessWidget {
  final Schedule schedule;
  final bool showYear;

  EBirthdayCard({super.key, required this.schedule, this.showYear = false});

  @override
  Widget build(BuildContext context) {
    final d = parseDate(schedule.date) ?? DateTime.now();
    final dateStr = '${showYear ? '${d.year}. ' : ''}${d.month}. ${d.day}.';

    // "HAPPY HAYOUNG DAY" → 이름만 핑크
    final m = RegExp(r'^HAPPY (.+) DAY$').firstMatch(schedule.title);

    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      clipBehavior: Clip.hardEdge,
      decoration: BoxDecoration(
        border: Border.all(color: const Color(0xFFF2C7D4)),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFFF3F7), Color(0xFFFDEFF4), Color(0xFFF4EDF9)],
          stops: [0, 0.55, 1],
        ),
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            right: -22,
            top: -22,
            child: Container(
              width: 90,
              height: 90,
              decoration: BoxDecoration(
                color: _rgba(const Color(0xFFE46E96), 0.1),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'HAPPY BIRTHDAY',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 3,
                  color: Color(0xFFD4548A),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  if (schedule.memberImage != null) ...[
                    Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                        boxShadow: [
                          BoxShadow(
                            color: _rgba(const Color(0xFFD4548A), 0.22),
                            blurRadius: 14,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: ClipOval(
                        child: CachedNetworkImage(
                          imageUrl: schedule.memberImage!,
                          width: 48,
                          height: 48,
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                  ],
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _HighlightTitle(
                          full: decodeHtmlEntities(schedule.title),
                          prefix: m != null ? 'HAPPY ' : null,
                          highlight: m?.group(1),
                          suffix: m != null ? ' DAY' : null,
                          highlightColor: const Color(0xFFD4548A),
                        ),
                        Padding(
                          padding: const EdgeInsets.only(top: 3),
                          child: Text(
                            dateStr,
                            style: const TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFFA98795),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
          const Positioned(
            right: 4,
            bottom: 0,
            child: Text('🎂', style: TextStyle(fontSize: 18)),
          ),
        ],
      ),
    );
  }
}

/// 데뷔/주년 카드 — 카테고리 색 기반
class EDebutCard extends StatelessWidget {
  final Schedule schedule;

  EDebutCard({super.key, required this.schedule});

  @override
  Widget build(BuildContext context) {
    final isDebut = schedule.isDebut;
    final anniversaryYear = schedule.anniversaryYear;
    final color = parseColor(schedule.categoryColor);

    // "프로미스나인 데뷔 8주년" → "8주년"만 색 강조
    final m = RegExp(r'^(.*?)(\d+주년)$').firstMatch(schedule.title);

    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      clipBehavior: Clip.hardEdge,
      decoration: BoxDecoration(
        border: Border.all(color: _rgba(color, 0.35)),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_rgba(color, 0.07), _rgba(color, 0.12), _rgba(color, 0.16)],
          stops: const [0, 0.55, 1],
        ),
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            right: -22,
            top: -22,
            child: Container(
              width: 90,
              height: 90,
              decoration: BoxDecoration(
                color: _rgba(color, 0.12),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                isDebut ? 'DEBUT DAY' : 'ANNIVERSARY',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 3,
                  color: color,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      color: color,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: _rgba(color, 0.35),
                          blurRadius: 14,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Center(
                      child: isDebut
                          ? const Text(
                              'DEBUT',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1,
                                color: Colors.white,
                              ),
                            )
                          : Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  '$anniversaryYear',
                                  style: const TextStyle(
                                    fontSize: 17.5,
                                    fontWeight: FontWeight.w900,
                                    height: 1.0,
                                    color: Colors.white,
                                  ),
                                ),
                                const Text(
                                  'YEARS',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 1.5,
                                    color: Colors.white,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _HighlightTitle(
                          full: decodeHtmlEntities(schedule.title),
                          prefix: m?.group(1),
                          highlight: m?.group(2),
                          highlightColor: color,
                        ),
                        const Padding(
                          padding: EdgeInsets.only(top: 3),
                          child: Text(
                            '2018. 1. 24. — FROM US, PROMISE',
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                              color: EColors.esub,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
          Positioned(
            right: 4,
            bottom: 0,
            child: Text(
              '✦',
              style: TextStyle(fontSize: 16, color: _rgba(color, 0.7)),
            ),
          ),
        ],
      ),
    );
  }
}

/// 카드 제목 — prefix/highlight/suffix 분리 강조. highlight 없으면 full 표시.
class _HighlightTitle extends StatelessWidget {
  final String full;
  final String? prefix;
  final String? highlight;
  final String? suffix;
  final Color highlightColor;

  _HighlightTitle({
    required this.full,
    this.prefix,
    this.highlight,
    this.suffix,
    required this.highlightColor,
  });

  @override
  Widget build(BuildContext context) {
    const base = TextStyle(
      fontSize: 17.5,
      fontWeight: FontWeight.w900,
      height: 1.15,
      letterSpacing: -0.4,
      color: EColors.ink,
    );
    if (highlight == null) {
      return Text(
        full,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: base,
      );
    }
    return Text.rich(
      TextSpan(
        children: [
          if (prefix != null && prefix!.isNotEmpty) TextSpan(text: prefix),
          TextSpan(
            text: highlight,
            style: TextStyle(color: highlightColor),
          ),
          if (suffix != null && suffix!.isNotEmpty) TextSpan(text: suffix),
        ],
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: base,
    );
  }
}

/// 검색 결과 행 — 날짜 | 제목(검색어 강조) | 카테고리
class SearchRow extends StatelessWidget {
  final Schedule schedule;
  final String term;
  final VoidCallback onTap;

  SearchRow({
    super.key,
    required this.schedule,
    required this.term,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final d = parseDate(schedule.date) ?? DateTime.now();
    final time = formatHm(schedule.time);
    final color = parseColor(schedule.categoryColor);
    final dow = weekdaysKo[d.weekday % 7];
    // 검색 결과에서는 제목 대신 날짜를 물들인다 (웹과 동일).
    // 제목의 검색어 강조도 초록이라, 제목까지 칠하면 검색어가 묻히기 때문.
    final notice = isNoticeSchedule(
      categoryId: schedule.categoryId,
      title: schedule.title,
    );

    return InkWell(
      onTap: onTap,
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: EColors.hairline, width: 1)),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 15),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(
                width: 74,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 년도 (연도 구분용)
                    Text(
                      '${d.year}',
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: EColors.mute,
                      ),
                    ),
                    // 날짜 + 요일 한 줄 (같은 크기·잉크색)
                    Text(
                      '${d.month}.${d.day} $dow',
                      maxLines: 1,
                      softWrap: false,
                      overflow: TextOverflow.visible,
                      style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.3,
                        color: notice ? noticeColor : EColors.ink,
                      ),
                    ),
                    if (time != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 1),
                        child: Text(
                          time,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: EColors.mute,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _HighlightSearch(
                      text: decodeHtmlEntities(schedule.title),
                      term: term,
                    ),
                    if (schedule.sourceName != null &&
                        schedule.sourceName!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          schedule.sourceName!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12.5,
                            color: EColors.mute,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Text(
                schedule.categoryName ?? '',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 검색어 매칭 부분 그린 하이라이트
class _HighlightSearch extends StatelessWidget {
  final String text;
  final String term;

  _HighlightSearch({required this.text, required this.term});

  @override
  Widget build(BuildContext context) {
    const base = TextStyle(
      fontSize: 14.5,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.2,
      color: EColors.ink,
    );
    if (term.isEmpty) {
      return Text(
        text,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: base,
      );
    }
    final lower = text.toLowerCase();
    final t = term.toLowerCase();
    final spans = <TextSpan>[];
    var i = 0;
    while (true) {
      final j = lower.indexOf(t, i);
      if (j == -1) break;
      if (j > i) spans.add(TextSpan(text: text.substring(i, j)));
      spans.add(
        TextSpan(
          text: text.substring(j, j + term.length),
          style: TextStyle(color: appPalette.primary),
        ),
      );
      i = j + term.length;
    }
    if (spans.isEmpty) {
      return Text(
        text,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: base,
      );
    }
    if (i < text.length) spans.add(TextSpan(text: text.substring(i)));
    return Text.rich(
      TextSpan(children: spans),
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      style: base,
    );
  }
}

/// 새 패널이 아래에서 올라오며 이전 패널을 위에서 덮는 오버레이 슬라이드
/// (웹 일정 년월 픽커 ↔ 달력 전환: 새 패널 slide-up cover)
class SlideUpCover extends StatefulWidget {
  final Widget child; // 현재 표시할 패널 (key로 전환 감지)
  final Duration duration;
  final Curve curve;

  const SlideUpCover({
    super.key,
    required this.child,
    this.duration = const Duration(milliseconds: 420),
    this.curve = const Cubic(0.22, 1, 0.36, 1),
  });

  @override
  State<SlideUpCover> createState() => _SlideUpCoverState();
}

class _SlideUpCoverState extends State<SlideUpCover>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late Animation<Offset> _slide;
  Widget? _outgoing; // 전환 중 아래에 정지해 있는 이전 패널
  late Widget _incoming;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: widget.duration);
    _slide = Tween<Offset>(
      begin: const Offset(0, 1),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _ctrl, curve: widget.curve));
    _incoming = widget.child;
    _ctrl.value = 1; // 초기엔 정지 상태로 표시
  }

  @override
  void didUpdateWidget(SlideUpCover old) {
    super.didUpdateWidget(old);
    if (old.child.key != widget.child.key) {
      // 새 패널: 이전 패널을 아래에 정지시키고 새 패널을 위로 슬라이드
      setState(() {
        _outgoing = _incoming;
        _incoming = widget.child;
      });
      _ctrl.forward(from: 0).then((_) {
        if (mounted) setState(() => _outgoing = null);
      });
    } else {
      _incoming = widget.child;
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final fadeIn = CurvedAnimation(parent: _ctrl, curve: widget.curve);
    return ClipRect(
      // 컨테이너 높이는 새 패널(_incoming)이 결정 → 바깥 AnimatedSize가 즉시 따라옴.
      // 이전 패널은 Positioned로 높이에 영향 없이 아래에 정지(덮힘 + 페이드아웃).
      child: Stack(
        alignment: Alignment.topCenter,
        children: [
          if (_outgoing != null)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: FadeTransition(
                opacity: Tween<double>(begin: 1, end: 0).animate(fadeIn),
                child: _outgoing!,
              ),
            ),
          // 새 패널: 아래에서 슬라이드업 + 페이드인하며 덮음 (깜빡임 방지)
          FadeTransition(
            opacity: fadeIn,
            child: SlideTransition(position: _slide, child: _incoming),
          ),
        ],
      ),
    );
  }
}

/// 높이(0↔auto) + 페이드를 함께 애니메이션하며 열기/닫기 속도를 다르게 줄 수 있는 위젯.
/// (웹 달력 패널 open/close: height 0↔auto + opacity 0↔1)
class ExpandFade extends StatefulWidget {
  final bool expanded;
  final Widget child;
  final Duration openDuration;
  final Duration closeDuration;
  final Curve curve;

  const ExpandFade({
    super.key,
    required this.expanded,
    required this.child,
    this.openDuration = const Duration(milliseconds: 560),
    this.closeDuration = const Duration(milliseconds: 460),
    this.curve = Curves.easeInOutCubic,
  });

  @override
  State<ExpandFade> createState() => _ExpandFadeState();
}

class _ExpandFadeState extends State<ExpandFade>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: widget.openDuration,
      reverseDuration: widget.closeDuration,
      value: widget.expanded ? 1 : 0,
    );
  }

  @override
  void didUpdateWidget(ExpandFade old) {
    super.didUpdateWidget(old);
    if (old.expanded != widget.expanded) {
      widget.expanded ? _ctrl.forward() : _ctrl.reverse();
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, child) {
        final t = widget.curve.transform(_ctrl.value).clamp(0.0, 1.0);
        if (t == 0) return const SizedBox(width: double.infinity);
        return ClipRect(
          child: Align(
            alignment: Alignment.topCenter,
            heightFactor: t,
            child: Opacity(opacity: t, child: child),
          ),
        );
      },
      child: widget.child,
    );
  }
}
