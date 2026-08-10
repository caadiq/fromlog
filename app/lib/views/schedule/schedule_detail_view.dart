/// 일정 상세 화면 (에디토리얼 리뉴얼 — 웹 mobile/schedule/ScheduleDetail.jsx 대응)
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants.dart';
import '../../core/format_utils.dart';
import '../../models/schedule.dart';
import '../../services/schedules_service.dart';
import '../../widgets/e_motion.dart';
import 'widgets/detail_sections.dart';

/// 카테고리 ID 상수

/// 일정 상세 Provider
final scheduleDetailProvider = FutureProvider.family<ScheduleDetail, int>((
  ref,
  id,
) async {
  return await getSchedule(id);
});

class ScheduleDetailView extends ConsumerStatefulWidget {
  final int scheduleId;

  ScheduleDetailView({super.key, required this.scheduleId});

  @override
  ConsumerState<ScheduleDetailView> createState() => _ScheduleDetailViewState();
}

class _ScheduleDetailViewState extends ConsumerState<ScheduleDetailView> {
  late int _currentScheduleId;

  /// 에디토리얼 리뉴얼 완료 카테고리 (웹 EDITORIAL_SECTIONS)
  static const _editorialCategories = {
    CategoryId.youtube,
    CategoryId.x,
    CategoryId.event,
    CategoryId.variety,
    CategoryId.concert,
    CategoryId.fansign,
    CategoryId.ticket,
  };

  @override
  void initState() {
    super.initState();
    _currentScheduleId = widget.scheduleId;
  }

  /// URL 열기 (외부 앱)
  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheduleAsync = ref.watch(scheduleDetailProvider(_currentScheduleId));

    // 앨범 발매 일정은 앨범 상세로 리다이렉트 (웹과 동일)
    ref.listen(scheduleDetailProvider(_currentScheduleId), (prev, next) {
      final folder = next.whenOrNull(data: (d) => d.albumFolder);
      if (folder != null && mounted) {
        context.pushReplacement('/album/$folder');
      }
    });

    return scheduleAsync.when(
      loading: () => const Scaffold(
        backgroundColor: EColors.paper,
        body: Center(
          child: Text(
            '로딩 중...',
            style: TextStyle(fontSize: 14.5, color: EColors.mute),
          ),
        ),
      ),
      error: (error, stack) =>
          Scaffold(backgroundColor: EColors.paper, body: _buildErrorView()),
      data: (schedule) {
        final isEditorial = _editorialCategories.contains(schedule.categoryId);
        final bottomInset = MediaQuery.of(context).padding.bottom;
        return Scaffold(
          backgroundColor: EColors.paper,
          appBar: _buildHeader(schedule),
          body: SingleChildScrollView(
            padding: EdgeInsets.only(bottom: bottomInset),
            child: EFadeUp(
              fromY: 12,
              child: isEditorial
                  ? _buildEditorialSection(schedule)
                  : DefaultSection(schedule: schedule),
            ),
          ),
        );
      },
    );
  }

  /// 헤더 (공통) — 뒤로가기 + 카테고리 라벨(색상), 하단 헤어라인
  PreferredSizeWidget _buildHeader(ScheduleDetail schedule) {
    final categoryName = schedule.categoryName ?? '';
    final headerLabel =
        (schedule.categoryId == CategoryId.event &&
            schedule.subtype == 'university')
        ? '행사 · 대학축제'
        : categoryName;
    final color = schedule.categoryColor != null
        ? parseColor(schedule.categoryColor)
        : EColors.ink;

    return PreferredSize(
      preferredSize: const Size.fromHeight(53),
      child: Material(
        color: EColors.paper,
        child: SafeArea(
          bottom: false,
          child: Container(
            height: 52,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: EColors.hairline)),
            ),
            child: Row(
              children: [
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => Navigator.of(context).maybePop(),
                  child: const Padding(
                    padding: EdgeInsets.only(right: 12),
                    child: Icon(
                      LucideIcons.arrowLeft,
                      size: 20,
                      color: EColors.ink,
                    ),
                  ),
                ),
                Expanded(
                  child: Text(
                    headerLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.4,
                      color: color,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// 에러(404) 화면 — 웹 에디토리얼
  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              '404',
              style: TextStyle(
                fontSize: 64,
                fontWeight: FontWeight.w900,
                height: 1,
                letterSpacing: -3,
                color: EColors.faintLight,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              '일정을 찾을 수 없습니다',
              style: TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.4,
                color: EColors.ink,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              '요청하신 일정이 존재하지 않거나\n삭제되었을 수 있습니다.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14.5,
                height: 1.5,
                color: EColors.mute,
              ),
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: GestureDetector(
                onTap: () => Navigator.of(context).maybePop(),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    border: Border.all(color: EColors.ink),
                  ),
                  child: const Text(
                    '← 이전 페이지',
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.4,
                      color: EColors.ink,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: GestureDetector(
                onTap: () => context.go('/schedule'),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  alignment: Alignment.center,
                  color: EColors.ink,
                  child: const Text(
                    '일정 목록',
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.4,
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

  /// 에디토리얼 섹션 분기
  Widget _buildEditorialSection(ScheduleDetail schedule) {
    switch (schedule.categoryId) {
      case CategoryId.youtube:
        return YoutubeSection(schedule: schedule, launchUrl: _launchUrl);
      case CategoryId.x:
        return XSection(schedule: schedule, launchUrl: _launchUrl);
      case CategoryId.variety:
        return VarietySection(schedule: schedule, launchUrl: _launchUrl);
      case CategoryId.event:
        return EventSection(schedule: schedule, launchUrl: _launchUrl);
      case CategoryId.concert:
        return ConcertSection(
          schedule: schedule,
          launchUrl: _launchUrl,
          onRoundChange: (id) => setState(() => _currentScheduleId = id),
        );
      case CategoryId.fansign:
        return FansignSection(schedule: schedule, launchUrl: _launchUrl);
      case CategoryId.ticket:
        return TicketingSection(
          schedule: schedule,
          launchUrl: _launchUrl,
          onNavigate: (id) => setState(() => _currentScheduleId = id),
        );
      default:
        return const SizedBox.shrink();
    }
  }
}
