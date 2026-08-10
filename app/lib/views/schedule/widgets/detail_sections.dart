/// 일정 상세 — 행사·팬사인회·콘서트 섹션 (웹 ScheduleDetail 에디토리얼과 동일 디자인)
library;

import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:omni_video_player/omni_video_player.dart';
import 'package:kakao_map_sdk/kakao_map_sdk.dart';

import '../../../core/format_utils.dart';
import '../../../core/ticketing_utils.dart';
import '../../../models/schedule.dart';
import '../../../widgets/image_lightbox.dart';
import '../../../core/constants.dart';

// ─────────────────────────────────────────────────────────────
// 공용 에디토리얼 헬퍼
// ─────────────────────────────────────────────────────────────

/// 팩트용 날짜: "2026. 7. 8. (수) 19:00" (웹 formatFactDate)
String formatFactDate(String dateStr, String? time) {
  final base = formatFullDate(dateStr);
  final hm = formatHm(time);
  return hm != null ? '$base $hm' : base;
}

/// 콘서트 회차 탭용 날짜: "7. 8. (수)" (웹 roundDate)
String roundDate(String dateStr) {
  final d = DateTime.parse(dateStr);
  return '${d.month}. ${d.day}. (${weekdayKo(d)})';
}

/// 팩트 행 — 96px 라벨 | 값, 하단 헤어라인 (웹 Fact)
class Fact extends StatelessWidget {
  final String label;
  final Widget child;

  const Fact({super.key, required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 13),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: EColors.hairline)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 94,
            child: Padding(
              padding: const EdgeInsets.only(top: 1),
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                  color: EColors.mute,
                ),
              ),
            ),
          ),
          Expanded(
            child: DefaultTextStyle(
              style: const TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w600,
                height: 1.55,
                color: EColors.ink,
              ),
              child: child,
            ),
          ),
        ],
      ),
    );
  }
}

/// 섹션 제목 (border-t-2 ink + 대문자 트래킹) — SETLIST / MD 등
class _SectionRule extends StatelessWidget {
  final String label;

  const _SectionRule(this.label);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.only(top: 14),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: EColors.ink, width: 2)),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.6,
          color: EColors.ink,
        ),
      ),
    );
  }
}

/// 마커(핀) PNG 바이트를 코드로 생성 — 속이 꽉 찬 잉크 물방울 핀
/// 머리 원 + 아래 꼭지를 접선(tangent)으로 연결해 매끈한 지도핀 실루엣(구멍/벌어짐 없음)
Future<Uint8List> _buildPinBytes() async {
  const double s = 4; // 해상도 스케일
  const double r = 8 * s; // 머리 반지름 = 32
  const double cx = 8.5 * s; // 가로 중심 = 34
  const double cyHead = 1 * s + r; // 머리 중심 y = 36
  const double tipY = cyHead + 2 * r; // 꼭지 끝 y = 100
  const double w = 17 * s; // 68
  const double h = tipY; // 100

  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  final phi = math.acos(r / (tipY - cyHead)); // 꼭지에서 원으로의 접선 반각
  final path = Path()
    ..moveTo(cx, tipY) // 꼭지 끝
    ..lineTo(cx + r * math.sin(phi), cyHead + r * math.cos(phi)) // 오른쪽 접점
    ..arcTo(
      Rect.fromCircle(center: const Offset(cx, cyHead), radius: r),
      math.pi / 2 - phi,
      -(2 * math.pi - 2 * phi), // 윗쪽으로 크게 돌아 왼쪽 접점까지
      false,
    )
    ..close(); // 왼쪽 접점 → 꼭지 끝
  canvas.drawPath(
    path,
    Paint()
      ..color = EColors.ink
      ..isAntiAlias = true,
  );
  // 머리 가운데 흰색 원 (클래식 지도핀)
  canvas.drawCircle(
    const Offset(cx, cyHead),
    r * 0.42,
    Paint()
      ..color = Colors.white
      ..isAntiAlias = true,
  );
  final img = await recorder.endRecording().toImage(w.toInt(), h.toInt());
  final data = await img.toByteData(format: ui.ImageByteFormat.png);
  return data!.buffer.asUint8List();
}

/// 카카오맵 인라인 지도 (네이티브 SDK) + '카카오맵에서 보기' 버튼 — 웹 KakaoMap 대응
class KakaoMapButton extends StatelessWidget {
  final Venue venue;
  final Future<void> Function(String) launchUrl;

  const KakaoMapButton({
    super.key,
    required this.venue,
    required this.launchUrl,
  });

  @override
  Widget build(BuildContext context) {
    if (!venue.hasCoords || venue.kakaoMapUrl == null) {
      return const SizedBox.shrink();
    }
    final lat = double.tryParse(venue.lat!);
    final lng = double.tryParse(venue.lng!);
    if (lat == null || lng == null) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.only(top: 18),
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(border: Border.all(color: EColors.hairline)),
        child: Stack(
          children: [
            SizedBox(
              height: 220,
              width: double.infinity,
              child: KakaoMap(
                option: KakaoMapOption(
                  position: LatLng(lat, lng),
                  zoomLevel: 16,
                ),
                onMapReady: (controller) async {
                  try {
                    final bytes = await _buildPinBytes();
                    await controller.labelLayer.addPoi(
                      LatLng(lat, lng),
                      style: PoiStyle(icon: KImage.fromData(bytes, 21, 31)),
                    );
                  } catch (_) {}
                },
              ),
            ),
            // KAKAO MAP 라벨 (좌하단)
            const Positioned(
              left: 14,
              bottom: 12,
              child: Text(
                'KAKAO MAP',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1,
                  color: EColors.esub,
                ),
              ),
            ),
            // 카카오맵에서 보기 버튼 (우상단)
            Positioned(
              right: 12,
              top: 12,
              child: GestureDetector(
                onTap: () => launchUrl(venue.kakaoMapUrl!),
                child: Container(
                  color: EColors.ink,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  child: const Text(
                    '카카오맵에서 보기 →',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.3,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// URL 라벨 (호스트만, www 제거)
String _linkLabel(String url) {
  try {
    final host = Uri.parse(url).host;
    return host.replaceFirst(RegExp(r'^www\.'), '');
  } catch (_) {
    return url;
  }
}

// ─────────────────────────────────────────────────────────────
// 행사 섹션 (에디토리얼)
// ─────────────────────────────────────────────────────────────

class EventSection extends StatelessWidget {
  final ScheduleDetail schedule;
  final Future<void> Function(String) launchUrl;

  /// (호환용, 미사용) 상세 화면 스크롤 컨트롤러
  final ScrollController? scrollController;

  const EventSection({
    super.key,
    required this.schedule,
    required this.launchUrl,
    this.scrollController,
  });

  @override
  Widget build(BuildContext context) {
    final posters = schedule.posters;
    final venue = schedule.venue;
    final postUrls = schedule.postUrls;
    final lightboxImages =
        posters.map((p) => p.full).whereType<String>().toList();

    return Padding(
      padding: const EdgeInsets.only(bottom: 64),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 포스터
          if (posters.isNotEmpty && posters[0].best != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(44, 26, 44, 0),
              child: Column(
                children: [
                  GestureDetector(
                    onTap: () => showImageLightbox(context, lightboxImages, 0),
                    child: Container(
                      decoration: BoxDecoration(
                        boxShadow: [
                          BoxShadow(
                            color: EColors.ink.withValues(alpha: 0.2),
                            blurRadius: 48,
                            offset: const Offset(0, 20),
                          ),
                        ],
                      ),
                      child: CachedNetworkImage(
                        imageUrl: posters[0].best!,
                        width: double.infinity,
                        fit: BoxFit.cover,
                        placeholder: (_, _) => AspectRatio(
                          aspectRatio: 3 / 4,
                          child: Container(color: EColors.canvasDeep),
                        ),
                      ),
                    ),
                  ),
                  if (posters.length > 1) ...[
                    const SizedBox(height: 14),
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 4,
                            crossAxisSpacing: 6,
                            mainAxisSpacing: 6,
                          ),
                      itemCount: posters.length - 1,
                      itemBuilder: (context, i) {
                        final p = posters[i + 1];
                        return GestureDetector(
                          onTap: () =>
                              showImageLightbox(context, lightboxImages, i + 1),
                          child: Container(
                            decoration: BoxDecoration(
                              border: Border.all(color: EColors.hairline),
                            ),
                            child: p.thumb != null
                                ? CachedNetworkImage(
                                    imageUrl: p.thumb!,
                                    fit: BoxFit.cover,
                                    placeholder: (_, _) =>
                                        Container(color: EColors.canvas),
                                  )
                                : Container(color: EColors.canvas),
                          ),
                        );
                      },
                    ),
                  ],
                ],
              ),
            ),
          // 본문
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 26, 22, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  decodeHtmlEntities(schedule.title),
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    height: 1.35,
                    letterSpacing: -0.6,
                    color: EColors.ink,
                  ),
                ),
                const SizedBox(height: 22),
                // 팩트 시트
                Container(
                  decoration: const BoxDecoration(
                    border: Border(
                      top: BorderSide(color: EColors.ink, width: 2),
                    ),
                  ),
                  child: Column(
                    children: [
                      Fact(
                        label: 'DATE',
                        child: Text(formatFactDate(schedule.date, schedule.time)),
                      ),
                      if (venue != null)
                        Fact(
                          label: 'VENUE',
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(venue.name),
                              if (venue.address != null)
                                Padding(
                                  padding: const EdgeInsets.only(top: 2),
                                  child: Text(
                                    venue.address!,
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                      color: EColors.mute,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      if (postUrls.isNotEmpty)
                        Fact(
                          label: 'LINKS',
                          child: Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: [
                              for (final url in postUrls)
                                GestureDetector(
                                  onTap: () => launchUrl(url),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 6,
                                    ),
                                    decoration: BoxDecoration(
                                      border:
                                          Border.all(color: EColors.hairline),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(
                                          _linkLabel(url),
                                          style: const TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.bold,
                                            color: EColors.esub,
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        const Icon(
                                          LucideIcons.externalLink,
                                          size: 10,
                                          color: EColors.esub,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                // 카카오맵 버튼
                if (venue != null)
                  KakaoMapButton(venue: venue, launchUrl: launchUrl),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// 콘서트 섹션 (에디토리얼)
// ─────────────────────────────────────────────────────────────

class ConcertSection extends StatefulWidget {
  final ScheduleDetail schedule;
  final Future<void> Function(String) launchUrl;
  final void Function(int scheduleId) onRoundChange;

  const ConcertSection({
    super.key,
    required this.schedule,
    required this.launchUrl,
    required this.onRoundChange,
  });

  @override
  State<ConcertSection> createState() => _ConcertSectionState();
}

class _ConcertSectionState extends State<ConcertSection> {
  static const _collapseCount = 6;

  bool _expanded = false;

  ScheduleDetail get schedule => widget.schedule;

  List<ConcertRound> _allRounds() {
    final rounds = [
      ConcertRound(
        scheduleId: schedule.id,
        date: schedule.date,
        time: schedule.time,
      ),
      ...schedule.otherRounds,
    ]..sort((a, b) => a.date.compareTo(b.date));
    return rounds;
  }

  @override
  Widget build(BuildContext context) {
    final poster = schedule.poster;
    final venue = schedule.venue;
    final setlist = schedule.setlist;
    final merch = schedule.merchandise;
    final activeCount = schedule.activeMemberCount ?? 5;
    final rounds = _allRounds();
    final hasMultiRounds = rounds.length > 1;

    final collapsible = setlist.length > _collapseCount;
    final visibleSetlist = collapsible && !_expanded
        ? setlist.take(_collapseCount).toList()
        : setlist;

    return Padding(
      padding: const EdgeInsets.only(bottom: 64),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 포스터
          Padding(
            padding: const EdgeInsets.fromLTRB(56, 26, 56, 0),
            child: poster?.best != null
                ? GestureDetector(
                    onTap: poster?.full != null
                        ? () =>
                            showImageLightbox(context, [poster!.full!], 0)
                        : null,
                    child: Container(
                      decoration: BoxDecoration(
                        boxShadow: [
                          BoxShadow(
                            color: EColors.ink.withValues(alpha: 0.22),
                            blurRadius: 48,
                            offset: const Offset(0, 20),
                          ),
                        ],
                      ),
                      child: CachedNetworkImage(
                        imageUrl: poster!.best!,
                        width: double.infinity,
                        fit: BoxFit.cover,
                      ),
                    ),
                  )
                : AspectRatio(
                    aspectRatio: 3 / 4,
                    child: Container(
                      color: EColors.canvasDeep,
                      child: const Center(
                        child: Icon(
                          LucideIcons.ticket,
                          size: 40,
                          color: EColors.faint,
                        ),
                      ),
                    ),
                  ),
          ),
          // 본문
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 26, 22, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  decodeHtmlEntities(schedule.title),
                  style: const TextStyle(
                    fontSize: 23,
                    fontWeight: FontWeight.w800,
                    height: 1.35,
                    letterSpacing: -0.5,
                    color: EColors.ink,
                  ),
                ),
                // 회차 탭
                if (hasMultiRounds) ...[
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      for (var i = 0; i < rounds.length; i++) ...[
                        if (i > 0) const SizedBox(width: 6),
                        Expanded(
                          child: _RoundTab(
                            round: rounds[i],
                            current: rounds[i].scheduleId == schedule.id,
                            onTap: () {
                              if (rounds[i].scheduleId != schedule.id) {
                                widget.onRoundChange(rounds[i].scheduleId);
                              }
                            },
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
                const SizedBox(height: 20),
                // 팩트 시트
                Container(
                  decoration: const BoxDecoration(
                    border: Border(
                      top: BorderSide(color: EColors.ink, width: 2),
                    ),
                  ),
                  child: Column(
                    children: [
                      Fact(
                        label: 'DATE',
                        child:
                            Text(formatFactDate(schedule.date, schedule.time)),
                      ),
                      if (venue != null)
                        Fact(
                          label: 'VENUE',
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(venue.name),
                              if (venue.address != null)
                                Padding(
                                  padding: const EdgeInsets.only(top: 2),
                                  child: Text(
                                    venue.address!,
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                      color: EColors.mute,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                if (venue != null)
                  KakaoMapButton(venue: venue, launchUrl: widget.launchUrl),
                // SETLIST
                if (setlist.isNotEmpty) ...[
                  const SizedBox(height: 28),
                  _SectionRule('SETLIST — ${setlist.length}'),
                  for (var i = 0; i < visibleSetlist.length; i++)
                    _SetlistRow(
                      index: i + 1,
                      item: visibleSetlist[i],
                      activeCount: activeCount,
                    ),
                  if (collapsible)
                    GestureDetector(
                      onTap: () => setState(() => _expanded = !_expanded),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        alignment: Alignment.center,
                        child: Text(
                          _expanded
                              ? '접기 ↑'
                              : '전체 ${setlist.length}곡 펼치기 ↓',
                          style:  TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.4,
                            color: appPalette.primary,
                          ),
                        ),
                      ),
                    ),
                ],
                // MD
                if (merch.isNotEmpty) ...[
                  const SizedBox(height: 28),
                  _SectionRule('MD'),
                  const SizedBox(height: 14),
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 10,
                          mainAxisSpacing: 10,
                        ),
                    itemCount: merch.length,
                    itemBuilder: (context, i) {
                      final m = merch[i];
                      final urls =
                          merch.map((x) => x.full).whereType<String>().toList();
                      return GestureDetector(
                        onTap: () => showImageLightbox(context, urls, i),
                        child: Container(
                          decoration: BoxDecoration(
                            border: Border.all(color: EColors.hairline),
                          ),
                          child: (m.thumb ?? m.best) != null
                              ? CachedNetworkImage(
                                  imageUrl: m.thumb ?? m.best!,
                                  fit: BoxFit.cover,
                                  placeholder: (_, _) =>
                                      Container(color: EColors.canvas),
                                )
                              : Container(color: EColors.canvas),
                        ),
                      );
                    },
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 콘서트 회차 탭 하나
class _RoundTab extends StatelessWidget {
  final ConcertRound round;
  final bool current;
  final VoidCallback onTap;

  const _RoundTab({
    required this.round,
    required this.current,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: current ? EColors.ink : Colors.transparent,
          border: Border.all(color: current ? EColors.ink : EColors.hairline),
        ),
        child: Column(
          children: [
            Text(
              roundDate(round.date),
              style: TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w800,
                fontFeatures: const [FontFeature.tabularFigures()],
                color: current ? Colors.white : EColors.esub,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              formatHm(round.time) ?? '시간 미정',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.3,
                color: current
                    ? Colors.white.withValues(alpha: 0.8)
                    : EColors.mute,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 세트리스트 행
class _SetlistRow extends StatelessWidget {
  final int index;
  final SetlistItem item;
  final int activeCount;

  const _SetlistRow({
    required this.index,
    required this.item,
    required this.activeCount,
  });

  bool get _isUnit => item.members.isNotEmpty && item.members.length < activeCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: EColors.hairline)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 34,
            child: Text(
              index.toString().padLeft(2, '0'),
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                fontFeatures: [FontFeature.tabularFigures()],
                color: EColors.faint,
              ),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Flexible(
                      child: Text(
                        item.songName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          letterSpacing: -0.2,
                          color: EColors.ink,
                        ),
                      ),
                    ),
                    if (item.albumName != null) ...[
                      const SizedBox(width: 8),
                      Text(
                        item.albumName!,
                        style: const TextStyle(
                          fontSize: 13,
                          color: EColors.mute,
                        ),
                      ),
                    ],
                  ],
                ),
                if (_isUnit) ...[
                  const SizedBox(height: 4),
                  Wrap(
                    spacing: 4,
                    runSpacing: 4,
                    children: [
                      for (final m in item.members)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          color: appPalette.soft,
                          child: Text(
                            m.name,
                            style:  TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.bold,
                              color: appPalette.deep,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// 팬사인회 섹션 (에디토리얼)
// ─────────────────────────────────────────────────────────────

class FansignSection extends StatelessWidget {
  final ScheduleDetail schedule;
  final Future<void> Function(String) launchUrl;

  const FansignSection({
    super.key,
    required this.schedule,
    required this.launchUrl,
  });

  /// (라벨, 아이콘, 팩트 표기)
  (String, IconData, String) get _formatMeta => switch (schedule.format) {
        'online' => ('영상통화 팬사인회', LucideIcons.video, '영상통화 (비대면)'),
        'both' => ('대면 + 영상통화 팬사인회', LucideIcons.users, '대면 + 영상통화'),
        _ => ('대면 팬사인회', LucideIcons.edit3, '대면'),
      };

  @override
  Widget build(BuildContext context) {
    final postUrls = schedule.postUrls;
    final (label, icon, factText) = _formatMeta;

    return Padding(
      padding: const EdgeInsets.fromLTRB(22, 26, 22, 64),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 형식 뱃지
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(border: Border.all(color: EColors.ink)),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 12, color: EColors.ink),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.5,
                    color: EColors.ink,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          // 제목
          Text(
            decodeHtmlEntities(schedule.title),
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              height: 1.35,
              letterSpacing: -0.6,
              color: EColors.ink,
            ),
          ),
          const SizedBox(height: 22),
          // 팩트 시트 (장소는 당첨자 개별 안내라 미표기)
          Container(
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: EColors.ink, width: 2)),
            ),
            child: Column(
              children: [
                Fact(
                  label: 'DATE',
                  child: Text(formatFactDate(schedule.date, schedule.time)),
                ),
                if (schedule.fansignHost != null)
                  Fact(label: 'HOST', child: Text(schedule.fansignHost!)),
                Fact(label: 'FORMAT', child: Text(factText)),
                if (postUrls.isNotEmpty)
                  Fact(
                    label: 'LINKS',
                    child: Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        for (final url in postUrls)
                          GestureDetector(
                            onTap: () => launchUrl(url),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                border: Border.all(color: EColors.hairline),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    _linkLabel(url),
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      color: EColors.esub,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  const Icon(
                                    LucideIcons.externalLink,
                                    size: 10,
                                    color: EColors.esub,
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            '장소는 당첨자에게 개별 안내됩니다.',
            style: TextStyle(fontSize: 13, height: 1.7, color: EColors.mute),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// 티켓팅 섹션 (에디토리얼 — 단계 타임라인, 웹 TicketingSection과 동일)
// ─────────────────────────────────────────────────────────────


class _TicketingStep {
  final String key;
  final String name;
  final String? sub;
  final String when;
  final (String, String)? status;
  final bool current;
  final int? linkScheduleId;

  _TicketingStep({
    required this.key,
    required this.name,
    this.sub,
    required this.when,
    this.status,
    this.current = false,
    this.linkScheduleId,
  });
}

class TicketingSection extends StatelessWidget {
  final ScheduleDetail schedule;
  final Future<void> Function(String) launchUrl;
  final void Function(int scheduleId) onNavigate;

  const TicketingSection({
    super.key,
    required this.schedule,
    required this.launchUrl,
    required this.onNavigate,
  });

  Color _statusBg(String kind) => switch (kind) {
        'done' => EColors.canvas,
        'now' => appPalette.primary,
        _ => Colors.white,
      };

  Color _statusFg(String kind) => switch (kind) {
        'done' => EColors.mute,
        'now' => Colors.white,
        _ => EColors.esub,
      };

  @override
  Widget build(BuildContext context) {
    final pair = schedule.ticketingPair;
    final concert = schedule.ticketingConcert;
    final postUrls = schedule.postUrls;

    // 타임라인 단계 구성 — 인증(있으면) → 선예매 → 일반예매
    final steps = <_TicketingStep>[];
    if (schedule.authStart != null || schedule.authEnd != null) {
      steps.add(_TicketingStep(
        key: 'auth',
        name: '팬클럽 인증',
        sub: schedule.authNote ?? '선예매 참여 조건',
        when:
            '${ticketingFmtAuth(schedule.authStart)} – ${ticketingFmtAuth(schedule.authEnd)}',
        status: ticketingAuthStatus(schedule.authStart, schedule.authEnd),
      ));
    }
    final own = _TicketingStep(
      key: schedule.stage ?? 'general',
      name: ticketingStageLabel[schedule.stage] ?? '예매',
      sub: '이 일정',
      when: ticketingFmt(schedule.date, schedule.time),
      status: ticketingStageStatus(schedule.date, schedule.time),
      current: true,
    );
    final pairStep = pair != null
        ? _TicketingStep(
            key: pair.stage,
            name: ticketingStageLabel[pair.stage] ?? '예매',
            when: ticketingFmt(pair.date, pair.time),
            status: ticketingStageStatus(pair.date, pair.time),
            linkScheduleId: pair.scheduleId,
          )
        : null;
    final ordered = [own, if (pairStep != null) pairStep]
      ..sort((a, b) => (a.key == 'presale' ? 0 : 1) - (b.key == 'presale' ? 0 : 1));
    steps.addAll(ordered);

    return Padding(
      padding: const EdgeInsets.fromLTRB(22, 26, 22, 64),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 뱃지
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(border: Border.all(color: EColors.ink)),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(LucideIcons.ticket, size: 12, color: EColors.ink),
                const SizedBox(width: 6),
                Text(
                  '티켓팅${schedule.vendor != null ? ' · ${schedule.vendor}' : ''}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.5,
                    color: EColors.ink,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          // 제목
          Text(
            decodeHtmlEntities(schedule.title),
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              height: 1.35,
              letterSpacing: -0.6,
              color: EColors.ink,
            ),
          ),
          const SizedBox(height: 22),
          // 단계 타임라인
          Container(
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: EColors.ink, width: 2)),
            ),
            child: Column(
              children: [
                for (var i = 0; i < steps.length; i++)
                  GestureDetector(
                    onTap: steps[i].linkScheduleId != null
                        ? () => onNavigate(steps[i].linkScheduleId!)
                        : null,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 4, vertical: 15),
                      decoration: BoxDecoration(
                        color: steps[i].current ? EColors.canvas : null,
                        border: const Border(
                            bottom: BorderSide(color: EColors.hairline)),
                      ),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 30,
                            child: Text(
                              (i + 1).toString().padLeft(2, '0'),
                              style: TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w800,
                                fontFeatures: const [
                                  ui.FontFeature.tabularFigures()
                                ],
                                color: steps[i].current
                                    ? appPalette.primary
                                    : EColors.faint,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.baseline,
                                  textBaseline: TextBaseline.alphabetic,
                                  children: [
                                    Flexible(
                                      child: Text(
                                        steps[i].name,
                                        style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w800,
                                          letterSpacing: -0.3,
                                          color: EColors.ink,
                                        ),
                                      ),
                                    ),
                                    if (steps[i].sub != null) ...[
                                      const SizedBox(width: 6),
                                      Text(
                                        steps[i].sub!,
                                        style: const TextStyle(
                                          fontSize: 11.5,
                                          fontWeight: FontWeight.w600,
                                          letterSpacing: 0.5,
                                          color: EColors.mute,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  steps[i].when,
                                  style: const TextStyle(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.bold,
                                    color: EColors.ebody,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (steps[i].status != null) ...[
                            const SizedBox(width: 10),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: _statusBg(steps[i].status!.$2),
                                border: steps[i].status!.$2 == 'todo'
                                    ? Border.all(color: EColors.hairline)
                                    : null,
                              ),
                              child: Text(
                                steps[i].status!.$1,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1,
                                  color: _statusFg(steps[i].status!.$2),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          // 예매 버튼
          if (schedule.ticketUrl != null) ...[
            const SizedBox(height: 24),
            GestureDetector(
              onTap: () => launchUrl(schedule.ticketUrl!),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 14),
                color: EColors.ink,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      schedule.vendor != null
                          ? '${schedule.vendor}에서 예매'
                          : '예매 페이지',
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.5,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Icon(LucideIcons.externalLink,
                        size: 13, color: Colors.white),
                  ],
                ),
              ),
            ),
          ],
          // 매수 제한 + 공지 링크
          if (schedule.purchaseLimit != null || postUrls.isNotEmpty) ...[
            const SizedBox(height: 16),
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 8,
              runSpacing: 6,
              children: [
                if (schedule.purchaseLimit != null)
                  Text.rich(
                    TextSpan(
                      text: '매수 제한 ',
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: EColors.esub,
                      ),
                      children: [
                        TextSpan(
                          text: schedule.purchaseLimit!,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            color: EColors.ebody,
                          ),
                        ),
                      ],
                    ),
                  ),
                for (final url in postUrls)
                  GestureDetector(
                    onTap: () => launchUrl(url),
                    child: Container(
                      padding: const EdgeInsets.only(bottom: 2),
                      decoration: const BoxDecoration(
                        border: Border(
                            bottom: BorderSide(color: EColors.faint)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _linkLabel(url),
                            style: const TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.bold,
                              color: EColors.ebody,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(LucideIcons.externalLink,
                              size: 10, color: EColors.ebody),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ],
          // 연결 콘서트 카드
          if (concert != null) ...[
            const SizedBox(height: 36),
            const _SectionRule('CONCERT'),
            const SizedBox(height: 14),
            GestureDetector(
              onTap: concert.firstScheduleId != null
                  ? () => onNavigate(concert.firstScheduleId!)
                  : null,
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: EColors.hairline),
                ),
                child: Row(
                  children: [
                    SizedBox(
                      width: 64,
                      height: 64 * 4 / 3,
                      child: concert.posterThumbUrl != null
                          ? CachedNetworkImage(
                              imageUrl: concert.posterThumbUrl!,
                              fit: BoxFit.cover,
                            )
                          : Container(
                              color: EColors.canvasDeep,
                              alignment: Alignment.center,
                              child: const Text('◉',
                                  style: TextStyle(
                                      fontSize: 20, color: EColors.faint)),
                            ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            concert.title,
                            style: const TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w800,
                              height: 1.4,
                              letterSpacing: -0.3,
                              color: EColors.ink,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            [
                              if (concert.startDate != null)
                                concert.startDate!.replaceAll('-', '. ') +
                                    (concert.endDate != null &&
                                            concert.endDate !=
                                                concert.startDate
                                        ? ' – ${concert.endDate!.replaceAll('-', '. ')}'
                                        : ''),
                              if (concert.venueName != null)
                                concert.venueName!,
                            ].join(' · '),
                            style: const TextStyle(
                              fontSize: 12.5,
                              color: EColors.esub,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(LucideIcons.chevronRight,
                        size: 16, color: EColors.mute),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// 유튜브 섹션 (에디토리얼)
// ─────────────────────────────────────────────────────────────

class YoutubeSection extends StatelessWidget {
  final ScheduleDetail schedule;
  final Future<void> Function(String) launchUrl;

  const YoutubeSection({
    super.key,
    required this.schedule,
    required this.launchUrl,
  });

  @override
  Widget build(BuildContext context) {
    final videoId = schedule.videoId;
    final isScheduled = videoId == null;
    final isShorts = schedule.videoType == 'shorts';
    final channelName = schedule.channelName;

    Widget video;
    if (isScheduled) {
      video = _buildScheduledBanner(schedule.bannerUrl);
    } else if (isShorts) {
      video = Container(
        decoration: const BoxDecoration(
          color: EColors.ink,
          border: Border(bottom: BorderSide(color: EColors.hairline)),
        ),
        child: Center(
          child: FractionallySizedBox(
            widthFactor: 0.64,
            child: AspectRatio(
              aspectRatio: 9 / 16,
              child: OmniVideoPlayer(
                configuration: VideoPlayerConfiguration(
                  videoSourceConfiguration: VideoSourceConfiguration.youtube(
                    videoUrl: Uri.parse(
                      'https://www.youtube.com/watch?v=$videoId',
                    ),
                    preferredQualities: const [OmniVideoQuality.high720],
                  ),
                ),
                callbacks: const VideoPlayerCallbacks(),
              ),
            ),
          ),
        ),
      );
    } else {
      video = Container(
        decoration: const BoxDecoration(
          color: EColors.ink,
          border: Border(bottom: BorderSide(color: EColors.hairline)),
        ),
        child: AspectRatio(
          aspectRatio: 16 / 9,
          child: OmniVideoPlayer(
            configuration: VideoPlayerConfiguration(
              videoSourceConfiguration: VideoSourceConfiguration.youtube(
                videoUrl: Uri.parse('https://www.youtube.com/watch?v=$videoId'),
                preferredQualities: const [OmniVideoQuality.high720],
              ),
            ),
            callbacks: const VideoPlayerCallbacks(),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 64),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          video,
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 22, 22, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  decodeHtmlEntities(schedule.title),
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    height: 1.4,
                    letterSpacing: -0.5,
                    color: EColors.ink,
                  ),
                ),
                // 채널 행
                if (channelName != null)
                  Container(
                    margin: const EdgeInsets.only(top: 16),
                    padding: const EdgeInsets.only(bottom: 18),
                    decoration: const BoxDecoration(
                      border: Border(
                        bottom: BorderSide(color: EColors.hairline),
                      ),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            channelName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: EColors.ink,
                            ),
                          ),
                        ),
                        if (schedule.videoUrl != null) ...[
                          const SizedBox(width: 12),
                          GestureDetector(
                            onTap: () => launchUrl(
                              'https://www.youtube.com/watch?v=$videoId',
                            ),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 9,
                              ),
                              decoration: BoxDecoration(
                                border: Border.all(color: EColors.ink),
                              ),
                              child: const Text(
                                '영상 →',
                                style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.3,
                                  color: EColors.ink,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                // DATE 팩트
                Container(
                  decoration: channelName == null
                      ? const BoxDecoration(
                          border: Border(
                            top: BorderSide(color: EColors.hairline),
                          ),
                        )
                      : null,
                  margin: channelName == null
                      ? const EdgeInsets.only(top: 16)
                      : EdgeInsets.zero,
                  child: Fact(
                    label: 'DATE',
                    child: Text(formatFactDate(schedule.date, schedule.time)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// 업로드 예정 배너 (bg ink + 배너 이미지 + 시계 라벨)
  Widget _buildScheduledBanner(String? bannerUrl) {
    return Container(
      decoration: const BoxDecoration(
        color: EColors.ink,
        border: Border(bottom: BorderSide(color: EColors.hairline)),
      ),
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (bannerUrl != null)
              Opacity(
                opacity: 0.4,
                child: CachedNetworkImage(
                  imageUrl: bannerUrl,
                  fit: BoxFit.cover,
                  placeholder: (_, _) => const SizedBox.shrink(),
                  errorWidget: (_, _, _) => const SizedBox.shrink(),
                ),
              ),
            Positioned(
              left: 20,
              bottom: 20,
              child: Row(
                children: [
                  const Icon(
                    LucideIcons.clock,
                    size: 16,
                    color: Color(0xFFF2C94C),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '업로드 예정',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      letterSpacing: -0.2,
                      color: Colors.white.withValues(alpha: 0.95),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// 예능 섹션 (에디토리얼)
// ─────────────────────────────────────────────────────────────

class VarietySection extends StatelessWidget {
  final ScheduleDetail schedule;
  final Future<void> Function(String) launchUrl;

  const VarietySection({
    super.key,
    required this.schedule,
    required this.launchUrl,
  });

  @override
  Widget build(BuildContext context) {
    final thumb = schedule.varietyThumbnailUrl;
    final replayUrl = schedule.replayUrl;
    final isYoutubeReplay =
        replayUrl != null &&
        RegExp(r'youtu\.?be', caseSensitive: false).hasMatch(replayUrl);

    return Padding(
      padding: const EdgeInsets.only(bottom: 64),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (thumb != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(64, 26, 64, 0),
              child: Container(
                decoration: BoxDecoration(
                  boxShadow: [
                    BoxShadow(
                      color: EColors.ink.withValues(alpha: 0.2),
                      blurRadius: 48,
                      offset: const Offset(0, 20),
                    ),
                  ],
                ),
                child: CachedNetworkImage(
                  imageUrl: thumb,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  placeholder: (_, _) => AspectRatio(
                    aspectRatio: 16 / 9,
                    child: Container(color: EColors.canvasDeep),
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 22, 22, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  decodeHtmlEntities(schedule.title),
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    height: 1.4,
                    letterSpacing: -0.5,
                    color: EColors.ink,
                  ),
                ),
                const SizedBox(height: 20),
                Container(
                  decoration: const BoxDecoration(
                    border: Border(
                      top: BorderSide(color: EColors.ink, width: 2),
                    ),
                  ),
                  child: Column(
                    children: [
                      Fact(
                        label: 'DATE',
                        child: Text(
                          formatFactDate(schedule.date, schedule.time),
                        ),
                      ),
                      if (schedule.broadcaster != null)
                        Fact(
                          label: 'BROADCAST',
                          child: Text(schedule.broadcaster!),
                        ),
                    ],
                  ),
                ),
                if (replayUrl != null) ...[
                  const SizedBox(height: 20),
                  GestureDetector(
                    onTap: () => launchUrl(replayUrl),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      color: EColors.ink,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            isYoutubeReplay
                                ? LucideIcons.play
                                : LucideIcons.externalLink,
                            size: 12,
                            color: Colors.white,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            schedule.broadcaster != null
                                ? '${schedule.broadcaster}에서 다시보기'
                                : '다시보기',
                            style: const TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.4,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// X 섹션 (에디토리얼)
// ─────────────────────────────────────────────────────────────

class XSection extends StatelessWidget {
  final ScheduleDetail schedule;
  final Future<void> Function(String) launchUrl;

  const XSection({
    super.key,
    required this.schedule,
    required this.launchUrl,
  });

  /// X용 날짜/시간 포맷 (오후 2:30 · 2026년 1월 15일)
  String _formatXDateTime(String dateStr, String? timeStr) {
    final date = DateTime.parse(dateStr);
    var result = '${date.year}년 ${date.month}월 ${date.day}일';
    if (timeStr != null && timeStr.length >= 5) {
      final parts = timeStr.split(':');
      final hours = int.parse(parts[0]);
      final minutes = parts[1];
      final period = hours < 12 ? '오전' : '오후';
      final hour12 = hours == 0 ? 12 : (hours > 12 ? hours - 12 : hours);
      result = '$period $hour12:$minutes · $result';
    }
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final username = schedule.username ?? 'realfromis_9';
    final displayName = schedule.profileDisplayName ?? username;
    final avatarUrl = schedule.profileAvatarUrl;
    final hasImages = schedule.imageUrls.isNotEmpty;
    final hasVideos = schedule.videoThumbnails.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.fromLTRB(22, 20, 22, 64),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: EColors.hairline),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 프로필 헤더
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
              child: Row(
                children: [
                  ClipOval(
                    child: avatarUrl != null
                        ? CachedNetworkImage(
                            imageUrl: avatarUrl,
                            width: 42,
                            height: 42,
                            fit: BoxFit.cover,
                            placeholder: (_, _) => _avatarFallback(displayName),
                            errorWidget: (_, _, _) =>
                                _avatarFallback(displayName),
                          )
                        : _avatarFallback(displayName),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                displayName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                  color: EColors.ink,
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),
                            _verifiedBadge(),
                          ],
                        ),
                        Text(
                          '@$username',
                          style: const TextStyle(
                            fontSize: 13,
                            color: EColors.mute,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // 본문
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 4),
              child: _buildLinkifiedText(
                decodeHtmlEntities(schedule.content ?? schedule.title),
              ),
            ),
            // 이미지
            if (hasImages)
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
                child: _buildXImageGrid(context, schedule.imageUrls),
              ),
            // 영상 썸네일
            if (hasVideos)
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
                child: Column(
                  children: [
                    for (final thumb in schedule.videoThumbnails)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 3),
                        child: GestureDetector(
                          onTap: schedule.postUrl != null
                              ? () => launchUrl(schedule.postUrl!)
                              : null,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              CachedNetworkImage(
                                imageUrl: thumb,
                                fit: BoxFit.cover,
                                width: double.infinity,
                                placeholder: (_, _) => Container(
                                  height: 200,
                                  color: EColors.canvas,
                                ),
                                errorWidget: (_, _, _) =>
                                    const SizedBox.shrink(),
                              ),
                              Container(
                                width: 56,
                                height: 56,
                                decoration: BoxDecoration(
                                  color: Colors.black.withValues(alpha: 0.6),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.play_arrow_rounded,
                                  size: 32,
                                  color: Colors.white,
                                ),
                              ),
                              Positioned(
                                right: 10,
                                bottom: 10,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  color: Colors.black.withValues(alpha: 0.7),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      _xLogo(10),
                                      const SizedBox(width: 6),
                                      const Text(
                                        'X에서 재생',
                                        style: TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            // OG 카드 (이미지·영상 없을 때만)
            if (schedule.card != null && !hasImages && !hasVideos)
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
                child: GestureDetector(
                  onTap: () => launchUrl(schedule.card!.url),
                  child: Container(
                    clipBehavior: Clip.antiAlias,
                    decoration: BoxDecoration(
                      border: Border.all(color: EColors.hairline),
                    ),
                    child: IntrinsicHeight(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (schedule.card!.image != null)
                            SizedBox(
                              width: 96,
                              child: CachedNetworkImage(
                                imageUrl: schedule.card!.image!,
                                fit: BoxFit.cover,
                                placeholder: (_, _) =>
                                    Container(color: EColors.canvas),
                                errorWidget: (_, _, _) => Container(
                                  color: EColors.canvas,
                                  child: const Icon(
                                    LucideIcons.link2,
                                    size: 20,
                                    color: EColors.faint,
                                  ),
                                ),
                              ),
                            ),
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (schedule.card!.destination != null)
                                    Padding(
                                      padding: const EdgeInsets.only(bottom: 2),
                                      child: Text(
                                        schedule.card!.destination!,
                                        style: const TextStyle(
                                          fontSize: 13,
                                          color: EColors.mute,
                                        ),
                                      ),
                                    ),
                                  if (schedule.card!.title != null)
                                    Text(
                                      decodeHtmlEntities(schedule.card!.title!),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 14.5,
                                        fontWeight: FontWeight.w600,
                                        color: EColors.ink,
                                      ),
                                    ),
                                  if (schedule.card!.description != null)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 2),
                                      child: Text(
                                        decodeHtmlEntities(
                                          schedule.card!.description!,
                                        ),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontSize: 13.5,
                                          color: EColors.esub,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            // 게시 시각
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(top: 14),
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: EColors.hairline)),
              ),
              child: Text(
                _formatXDateTime(schedule.date, schedule.time),
                style: const TextStyle(fontSize: 13.5, color: EColors.mute),
              ),
            ),
            // X에서 보기
            if (schedule.postUrl != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
                child: GestureDetector(
                  onTap: () => launchUrl(schedule.postUrl!),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    color: EColors.ink,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _xLogo(14),
                        const SizedBox(width: 8),
                        const Text(
                          'X에서 보기',
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.4,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// 본문 링크 처리 (웹 linkifyText — 해시태그·URL 모두 에디토리얼 그린)
  Widget _buildLinkifiedText(String text) {
    final pattern = RegExp(
      r"(#[^\s#]+)|(https?://[^\s]+|(?:bit\.ly|youtu\.be|t\.co|goo\.gl|tinyurl\.com)/[^\s]+)",
      caseSensitive: false,
    );
    const baseStyle = TextStyle(fontSize: 15, height: 1.75, color: EColors.ink);
    final linkStyle = TextStyle(
      fontSize: 15,
      height: 1.75,
      fontWeight: FontWeight.w600,
      color: appPalette.primary,
    );

    final spans = <TextSpan>[];
    var last = 0;
    for (final m in pattern.allMatches(text)) {
      if (m.start > last) {
        spans.add(TextSpan(text: text.substring(last, m.start)));
      }
      final matched = m.group(0)!;
      if (matched.startsWith('#')) {
        final tag = matched.substring(1);
        spans.add(
          TextSpan(
            text: matched,
            style: linkStyle,
            recognizer: TapGestureRecognizer()
              ..onTap = () => launchUrl(
                'https://x.com/hashtag/${Uri.encodeComponent(tag)}?src=hashtag_click',
              ),
          ),
        );
      } else {
        final href = matched.startsWith('http') ? matched : 'https://$matched';
        spans.add(
          TextSpan(
            text: matched,
            style: linkStyle,
            recognizer: TapGestureRecognizer()..onTap = () => launchUrl(href),
          ),
        );
      }
      last = m.end;
    }
    if (last < text.length) {
      spans.add(TextSpan(text: text.substring(last)));
    }

    return Text.rich(TextSpan(style: baseStyle, children: spans));
  }

  /// X 이미지 그리드 (웹과 동일: 1장 상단크롭 최대 480, 3장 첫 장 세로 2칸, 그 외 2열)
  Widget _buildXImageGrid(BuildContext context, List<String> urls) {
    final shown = urls.take(4).toList();
    Widget img(String url, {BoxFit fit = BoxFit.cover}) {
      return GestureDetector(
        onTap: () => showImageLightbox(context, urls, urls.indexOf(url)),
        child: CachedNetworkImage(
          imageUrl: url,
          fit: fit,
          width: double.infinity,
          height: double.infinity,
          placeholder: (_, _) => Container(color: EColors.canvas),
          errorWidget: (_, _, _) => Container(color: EColors.canvas),
        ),
      );
    }

    if (shown.length == 1) {
      return ConstrainedBox(
        constraints: const BoxConstraints(maxHeight: 480),
        child: GestureDetector(
          onTap: () => showImageLightbox(context, urls, 0),
          child: CachedNetworkImage(
            imageUrl: shown[0],
            fit: BoxFit.cover,
            alignment: Alignment.topCenter,
            width: double.infinity,
            placeholder: (_, _) => AspectRatio(
              aspectRatio: 4 / 3,
              child: Container(color: EColors.canvas),
            ),
          ),
        ),
      );
    }
    if (shown.length == 3) {
      return AspectRatio(
        aspectRatio: 1,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: img(shown[0])),
            const SizedBox(width: 3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(child: img(shown[1])),
                  const SizedBox(height: 3),
                  Expanded(child: img(shown[2])),
                ],
              ),
            ),
          ],
        ),
      );
    }
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 3,
        mainAxisSpacing: 3,
      ),
      itemCount: shown.length,
      itemBuilder: (context, index) => img(shown[index]),
    );
  }

  Widget _avatarFallback(String name) {
    return Container(
      width: 42,
      height: 42,
      color: EColors.ink,
      alignment: Alignment.center,
      child: Text(
        name.isNotEmpty ? name[0].toUpperCase() : '?',
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.bold,
          fontSize: 16,
        ),
      ),
    );
  }

  Widget _verifiedBadge() {
    return SizedBox(
      width: 14,
      height: 14,
      child: CustomPaint(painter: _VerifiedBadgePainter()),
    );
  }

  Widget _xLogo(double size) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _XLogoPainter()),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// 기본 섹션 — 에디토리얼 (리뉴얼 안 된 기타 카테고리용)
// ─────────────────────────────────────────────────────────────

class DefaultSection extends StatelessWidget {
  final ScheduleDetail schedule;

  const DefaultSection({super.key, required this.schedule});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(22, 26, 22, 64),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            decodeHtmlEntities(schedule.title),
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              height: 1.35,
              letterSpacing: -0.6,
              color: EColors.ink,
            ),
          ),
          const SizedBox(height: 22),
          // 팩트 시트
          Container(
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: EColors.ink, width: 2)),
            ),
            child: Fact(
              label: 'DATE',
              child: Text(formatFactDate(schedule.date, schedule.time)),
            ),
          ),
          if (schedule.description != null &&
              schedule.description!.isNotEmpty) ...[
            const SizedBox(height: 20),
            Text(
              decodeHtmlEntities(schedule.description!),
              style: const TextStyle(
                fontSize: 15,
                height: 1.7,
                color: EColors.ebody,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// 인증 배지 페인터 (X 블루)
class _VerifiedBadgePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF1D9BF0)
      ..style = PaintingStyle.fill;
    final center = Offset(size.width / 2, size.height / 2);
    canvas.drawCircle(center, size.width / 2, paint);

    final checkPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final checkPath = Path()
      ..moveTo(size.width * 0.28, size.height * 0.52)
      ..lineTo(size.width * 0.45, size.height * 0.68)
      ..lineTo(size.width * 0.72, size.height * 0.35);
    canvas.drawPath(checkPath, checkPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// X 로고 페인터
class _XLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;
    final path = Path()
      ..moveTo(size.width * 0.76, size.height * 0.09)
      ..lineTo(size.width * 0.9, size.height * 0.09)
      ..lineTo(size.width * 0.6, size.height * 0.44)
      ..lineTo(size.width * 0.95, size.height * 0.91)
      ..lineTo(size.width * 0.67, size.height * 0.91)
      ..lineTo(size.width * 0.46, size.height * 0.63)
      ..lineTo(size.width * 0.21, size.height * 0.91)
      ..lineTo(size.width * 0.07, size.height * 0.91)
      ..lineTo(size.width * 0.4, size.height * 0.53)
      ..lineTo(size.width * 0.05, size.height * 0.09)
      ..lineTo(size.width * 0.34, size.height * 0.09)
      ..lineTo(size.width * 0.52, size.height * 0.35)
      ..close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
