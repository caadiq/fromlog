/// 홈 화면 — 에디토리얼 리뉴얼 (웹 pages/mobile/home/Home.jsx 대응)
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/constants.dart';
import '../../core/format_utils.dart';
import '../../models/album.dart';
import '../../models/schedule.dart';
import '../../controllers/home_controller.dart';
import '../../widgets/editorial.dart';
import '../../widgets/e_motion.dart';

/// D-day 계산 (오늘 기준, 웹 calcDday와 동일)
int? _calcDday(String? dateStr) {
  if (dateStr == null || dateStr.isEmpty) return null;
  final d = parseDate(dateStr);
  if (d == null) return null;
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  return DateTime(d.year, d.month, d.day).difference(today).inDays;
}

/// 발매 전 여부
bool _isUpcoming(String? releaseDate) {
  final diff = _calcDday(releaseDate);
  return diff != null && diff > 0;
}

class HomeView extends ConsumerWidget {
  const HomeView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(homeProvider);

    if (state.isLoading && !state.dataLoaded) {
      return const Center(
        child: CircularProgressIndicator(color: EColors.ink, strokeWidth: 2.5),
      );
    }

    if (state.error != null && state.members.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              '데이터를 불러올 수 없습니다',
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
                color: EColors.mute,
              ),
            ),
            const SizedBox(height: 14),
            GestureDetector(
              onTap: () => ref.read(homeProvider.notifier).loadData(),
              child: Container(
                color: EColors.ink,
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 11,
                ),
                child: const Text(
                  '다시 시도',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    final albums = state.albums;
    final topAlbums = albums.take(3).toList();
    final dated = state.schedules
        .where((s) => s.datePrecision != 'month')
        .toList();
    final undated = state.schedules
        .where((s) => s.datePrecision == 'month')
        .toList();

    return RefreshIndicator(
      color: EColors.ink,
      backgroundColor: EColors.paper,
      onRefresh: () => ref.read(homeProvider.notifier).loadData(),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Hero(),
            _StatsStrip(memberCount: state.members.length, albums: albums),
            const EReveal(
              child: SecHeader(label: 'MEMBERS', to: '/members'),
            ),
            _MembersList(state: state),
            const EReveal(
              child: SecHeader(label: 'DISCOGRAPHY', to: '/album'),
            ),
            _Discography(albums: topAlbums),
            const EReveal(
              child: SecHeader(label: 'SCHEDULE', to: '/schedule'),
            ),
            EReveal(
              child: _ScheduleList(dated: dated, undated: undated),
            ),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }
}

/// 히어로 — SINCE 라벨 + fromis_9 워드마크 + 인사말
class _Hero extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(22, 34, 22, 30),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: EColors.hairline, width: 1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          EFadeUp(
            delayMs: 0,
            child: Text(
              'SINCE 2018. 01. 24',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                letterSpacing: 3,
                color: appPalette.primary,
              ),
            ),
          ),
          const SizedBox(height: 14),
          const EFadeUp(
            delayMs: kStaggerMs,
            child: OutlineTitle(
              solid: 'fromis',
              outline: '_9',
              fontSize: 62,
              letterSpacing: -3,
            ),
          ),
          const SizedBox(height: 16),
          EFadeUp(
            delayMs: kStaggerMs * 2,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 280),
              child: const Text(
                '"인사드리겠습니다. 둘, 셋!\n안녕하세요, 프로미스나인입니다!"',
                style: TextStyle(
                  fontSize: 14.5,
                  height: 1.7,
                  color: EColors.esub,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 통계 스트립 — MEMBERS / ALBUMS / D-day
class _StatsStrip extends StatelessWidget {
  final int memberCount;
  final List<Album> albums;

  const _StatsStrip({required this.memberCount, required this.albums});

  @override
  Widget build(BuildContext context) {
    // 최신 앨범 D-day 셀 (발매 전 D-N → 당일 D-DAY → 발매 후 OUT NOW)
    (String, String)? stripAlbum;
    if (albums.isNotEmpty) {
      final diff = _calcDday(albums.first.releaseDate);
      if (diff != null) {
        final label = albums.first.albumType ?? '앨범';
        stripAlbum = diff > 0
            ? ('D-$diff', label)
            : diff == 0
            ? ('D-DAY', label)
            : ('OUT NOW', label);
      }
    }

    final cells = [
      ('$memberCount', 'MEMBERS'),
      ('${albums.length}', 'ALBUMS'),
      if (stripAlbum != null) stripAlbum,
    ];

    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: EColors.hairline, width: 1)),
      ),
      child: Row(
        children: [
          for (var i = 0; i < cells.length; i++)
            Expanded(
              child: EFadeUp(
                delayMs: kStaggerMs * i,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    border: i < cells.length - 1
                        ? const Border(
                            right: BorderSide(
                              color: EColors.hairline,
                              width: 1,
                            ),
                          )
                        : null,
                  ),
                  child: Column(
                    children: [
                      Text(
                        cells[i].$1,
                        style: const TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.w800,
                          color: EColors.ink,
                        ),
                      ),
                      Text(
                        cells[i].$2,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.5,
                          color: EColors.mute,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// MEMBERS — 번호 + 아바타 + 이름/영문 행 목록
class _MembersList extends StatelessWidget {
  final HomeState state;

  const _MembersList({required this.state});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 22),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: EColors.hairline, width: 1)),
      ),
      child: Column(
        children: [
          for (var i = 0; i < state.members.length; i++)
            EReveal(
              delayMs: kStaggerMs * i,
              child: InkWell(
                onTap: () => context.push('/members'),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  decoration: const BoxDecoration(
                    border: Border(
                      bottom: BorderSide(color: EColors.hairline, width: 1),
                    ),
                  ),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 22,
                        child: Text(
                          (i + 1).toString().padLeft(2, '0'),
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: EColors.faint,
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      ClipOval(
                        child: state.members[i].imageUrl != null
                            ? CachedNetworkImage(
                                imageUrl: state.members[i].imageUrl!,
                                width: 46,
                                height: 46,
                                fit: BoxFit.cover,
                              )
                            : Container(
                                width: 46,
                                height: 46,
                                color: EColors.canvas,
                              ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              state.members[i].name,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.3,
                                color: EColors.ink,
                              ),
                            ),
                            Text(
                              (state.members[i].nameEn ?? '').toUpperCase(),
                              style: const TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 1.5,
                                color: EColors.mute,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Text(
                        '→',
                        style: TextStyle(fontSize: 15, color: EColors.faint),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// DISCOGRAPHY — 대형 최신 커버 + 2열 서브 커버
class _Discography extends StatelessWidget {
  final List<Album> albums;

  const _Discography({required this.albums});

  String _bigSub(Album a) {
    final date = (a.releaseDate ?? '').split('T')[0].replaceAll('-', '. ');
    final upcoming = _isUpcoming(a.releaseDate) ? ' 발매 예정' : '';
    return '${a.albumType ?? ''} · $date$upcoming';
  }

  String _smallSub(Album a) {
    final type = (a.albumTypeShort ?? a.albumType ?? '').toUpperCase();
    final year = (a.releaseDate ?? '').split('-')[0];
    final upcoming = _isUpcoming(a.releaseDate) ? ' · 발매 예정' : '';
    return '$type · $year$upcoming';
  }

  Widget _cover(Album a, {double iconSize = 28}) {
    final url = a.coverMediumUrl ?? a.coverOriginalUrl;
    return AspectRatio(
      aspectRatio: 1,
      child: url != null
          ? CachedNetworkImage(imageUrl: url, fit: BoxFit.cover)
          : Container(
              color: EColors.canvasDeep,
              alignment: Alignment.center,
              child: Text(
                '◉',
                style: TextStyle(fontSize: iconSize, color: EColors.faint),
              ),
            ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (albums.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 대형 최신 커버
          EReveal(
            child: GestureDetector(
              onTap: () => context.push('/album/${albums[0].folderName}'),
              child: Stack(
                children: [
                  _cover(albums[0], iconSize: 40),
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: Container(
                      padding: const EdgeInsets.all(18),
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.bottomCenter,
                          end: Alignment.topCenter,
                          colors: [Color(0xB3000000), Colors.transparent],
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            albums[0].title,
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.5,
                              color: Colors.white,
                            ),
                          ),
                          Text(
                            _bigSub(albums[0]),
                            style: TextStyle(
                              fontSize: 13,
                              letterSpacing: 1,
                              color: Colors.white.withValues(alpha: 0.75),
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
          // 서브 커버 2장
          if (albums.length > 1) ...[
            const SizedBox(height: 14),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var i = 1; i < albums.length && i < 3; i++) ...[
                  if (i > 1) const SizedBox(width: 14),
                  Expanded(
                    child: EReveal(
                      delayMs: kStaggerMs * (i - 1),
                      child: GestureDetector(
                        onTap: () =>
                            context.push('/album/${albums[i].folderName}'),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _cover(albums[i]),
                            const SizedBox(height: 8),
                            Text(
                              albums[i].title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 14.5,
                                fontWeight: FontWeight.w700,
                                letterSpacing: -0.2,
                                color: EColors.ink,
                              ),
                            ),
                            Text(
                              _smallSub(albums[i]),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 12.5,
                                letterSpacing: 0.5,
                                color: EColors.mute,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// SCHEDULE — 다가오는 일정 목록 (상단 2px 잉크 룰)
class _ScheduleList extends StatelessWidget {
  final List<Schedule> dated;
  final List<Schedule> undated;

  const _ScheduleList({required this.dated, required this.undated});

  void _openSchedule(BuildContext context, Schedule s) {
    if (s.albumFolder != null) {
      context.push('/album/${s.albumFolder}');
    } else {
      context.push('/schedule/${s.id}');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(22, 0, 22, 0),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: EColors.ink, width: 2)),
      ),
      child: Column(
        children: [
          for (final s in dated)
            _DatedRow(schedule: s, onTap: () => _openSchedule(context, s)),
          for (final s in undated)
            _UndatedRow(schedule: s, onTap: () => _openSchedule(context, s)),
        ],
      ),
    );
  }
}

/// 날짜 확정 일정 행 — 컴백(4)·앨범(17)은 그린 배경 + D-day 배지
class _DatedRow extends StatelessWidget {
  final Schedule schedule;
  final VoidCallback onTap;

  const _DatedRow({required this.schedule, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final d = parseDate(schedule.date);
    final featured = kFeaturedCategoryIds.contains(schedule.categoryId);
    final dday = featured ? _calcDday(schedule.date) : null;

    final time = (schedule.time != null && schedule.time!.isNotEmpty)
        ? schedule.time!.substring(0, 5)
        : null;
    final source =
        (schedule.sourceName != null && schedule.sourceName!.isNotEmpty)
        ? schedule.sourceName!
        : null;

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 15),
        decoration: BoxDecoration(
          color: featured ? appPalette.soft.withValues(alpha: 0.4) : null,
          border: const Border(
            bottom: BorderSide(color: EColors.hairline, width: 1),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            SizedBox(
              width: 66,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 다음 연도 일정이면 년도 표시
                  if (d != null && d.year != DateTime.now().year)
                    Text(
                      '${d.year}',
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: EColors.mute,
                      ),
                    ),
                  // 날짜 + 요일 (같은 크기·색으로 한 줄)
                  Text(
                    d != null
                        ? '${d.month}.${d.day} ${weekdaysKo[d.weekday % 7]}'
                        : '',
                    maxLines: 1,
                    softWrap: false,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                      color: EColors.ink,
                    ),
                  ),
                  // 시간 (날짜 밑)
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
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          schedule.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w600,
                            letterSpacing: -0.2,
                            color: EColors.ink,
                          ),
                        ),
                      ),
                      if (dday != null && dday >= 0) ...[
                        const SizedBox(width: 6),
                        Container(
                          color: appPalette.primary,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          child: Text(
                            dday == 0 ? 'D-DAY' : 'D-$dday',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (source != null)
                    Text(
                      source,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13, color: EColors.mute),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 16),
            CategoryLabelText(
              name: schedule.categoryName,
              colorHex: schedule.categoryColor,
            ),
          ],
        ),
      ),
    );
  }
}

/// 날짜 미정 일정 행 — 점선 하단 보더 + '--.--'
class _UndatedRow extends StatelessWidget {
  final Schedule schedule;
  final VoidCallback onTap;

  const _UndatedRow({required this.schedule, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final d = parseDate(schedule.date);

    return InkWell(
      onTap: onTap,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 15),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                const SizedBox(
                  width: 52,
                  child: Text(
                    '--.--',
                    style: TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w800,
                      color: EColors.faint,
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        schedule.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.2,
                          color: EColors.ink,
                        ),
                      ),
                      Text(
                        d != null ? '${d.month}월 중' : '',
                        style: const TextStyle(
                          fontSize: 13,
                          color: EColors.mute,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                CategoryLabelText(
                  name: schedule.categoryName,
                  colorHex: schedule.categoryColor,
                ),
              ],
            ),
          ),
          // 점선 하단 보더
          const DashedLine(),
        ],
      ),
    );
  }
}

/// 점선 구분선 (faint-light)
