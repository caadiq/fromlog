/// 일정 화면 (MVCS의 View 레이어)
///
/// UI 렌더링만 담당하고, 비즈니스 로직은 Controller에 위임합니다.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:expandable_page_view/expandable_page_view.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants.dart';
import '../../models/schedule.dart';
import '../../controllers/schedule_controller.dart';
import 'widgets/schedule_editorial.dart';
import 'widgets/schedule_link_panel.dart';
import '../../models/schedule_link.dart';
import '../../services/schedules_service.dart';
import '../../widgets/editorial.dart';
import '../../widgets/e_motion.dart';
import '../../core/format_utils.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../widgets/celebration_dialogs.dart';

part 'schedule_view_search.dart';
part 'schedule_view_calendar.dart';

class ScheduleView extends ConsumerStatefulWidget {
  const ScheduleView({super.key});

  @override
  ConsumerState<ScheduleView> createState() => _ScheduleViewState();
}

class _ScheduleViewState extends ConsumerState<ScheduleView> {
  final ScrollController _dateScrollController = ScrollController();
  final ScrollController _contentScrollController = ScrollController();
  final ScrollController _searchScrollController = ScrollController();
  final TextEditingController _searchInputController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();
  DateTime? _lastSelectedDate;

  /// 이번 날짜 선택에서 이미 진입 애니메이션을 재생한 카드 키
  /// (스크롤로 재빌드될 때 다시 재생되지 않도록)
  final Set<String> _playedCardKeys = {};

  // 검색 모드 상태
  bool _isSearchMode = false;
  // 추천 검색어 화면 표시 여부 (입력창 포커스 시)
  bool _showSuggestions = false;
  // 디바운스 타이머
  Timer? _debounceTimer;
  // 마지막 검색어 (뒤로가기 시 복원용)
  String _lastSearchTerm = '';

  // 고정 링크 패널 (달력과 배타적으로 열린다)
  bool _showLinks = false;
  List<ScheduleLink> _links = const [];

  // 달력 팝업 상태
  bool _showCalendar = false;
  DateTime _calendarViewDate = DateTime.now();
  bool _showYearMonthPicker = false;
  int _yearRangeStart = 2017 + ((DateTime.now().year - 2017) ~/ 4) * 4;

  // 달력 월 PageView (스와이프)
  late PageController _calendarPageController;
  static const int _initialPage = 1000;
  static const int _minYear = 2017; // 웹 MIN_YEAR — 이전 이동 하한

  @override
  void initState() {
    super.initState();
    _calendarPageController = PageController(initialPage: _initialPage);
    // 검색 무한 스크롤 리스너
    _searchScrollController.addListener(_onSearchScroll);
    _loadScheduleLinks();
  }

  /// 고정 링크 조회 — 실패해도 화면은 그대로 쓴다(버튼만 안 나옴)
  Future<void> _loadScheduleLinks() async {
    try {
      final links = await getScheduleLinks();
      if (mounted) setState(() => _links = links);
    } catch (_) {
      // 무시
    }
  }

  /// 고정 링크 패널 토글 (달력과 하나만 열린다)
  void _toggleLinks() {
    setState(() {
      _showLinks = !_showLinks;
      if (_showLinks) {
        _showCalendar = false;
        _showYearMonthPicker = false;
      }
    });
  }

  /// part 파일(extension)에서 상태 갱신용 setState 래퍼
  void _refresh(VoidCallback fn) => setState(fn);

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _dateScrollController.dispose();
    _contentScrollController.dispose();
    _searchScrollController.removeListener(_onSearchScroll);
    _searchScrollController.dispose();
    _searchInputController.dispose();
    _searchFocusNode.dispose();
    _calendarPageController.dispose();
    super.dispose();
  }

  /// 선택된 날짜로 스크롤
  void _scrollToSelectedDate(DateTime selectedDate) {
    if (!_dateScrollController.hasClients) return;

    final dayIndex = selectedDate.day - 1;
    const itemWidth = 52.0; // 44 + 8 (gap)
    const horizontalPadding = 8.0; // ListView padding
    final targetOffset =
        (dayIndex * itemWidth) +
        horizontalPadding -
        (MediaQuery.of(context).size.width / 2) +
        (itemWidth / 2);
    _dateScrollController.animateTo(
      targetOffset.clamp(0, _dateScrollController.position.maxScrollExtent),
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeInOutCubic,
    );
  }

  /// 날짜 선택 핸들러
  void _onDateSelected(DateTime date) {
    // 펼쳐둔 고정 링크 패널은 닫는다 — 시선이 날짜/목록으로 옮겨갔다 (웹과 동일)
    if (_showLinks) {
      setState(() => _showLinks = false);
    }
    // 일정 목록 맨 위로 즉시 이동
    if (_contentScrollController.hasClients) {
      _contentScrollController.jumpTo(0);
    }
    // Controller에 날짜 선택 요청
    ref.read(scheduleProvider.notifier).selectDate(date);
    // 선택된 날짜로 스크롤
    _scrollToSelectedDate(date);
  }

  bool _celebrationChecked = false;

  /// 오늘이 생일/데뷔·주년이면 폭죽 + 축하 다이얼로그 (웹과 동일, 하루 1회)
  Future<void> _maybeCelebrate(List<Schedule> schedules) async {
    if (_celebrationChecked || schedules.isEmpty || !mounted) return;
    _celebrationChecked = true;

    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final prefs = await SharedPreferences.getInstance();

    Schedule? findToday(bool Function(Schedule) test) {
      for (final s in schedules) {
        if (test(s) && s.date.split('T')[0] == today) return s;
      }
      return null;
    }

    final birthday = findToday((s) => s.isBirthday);
    final debut = findToday((s) => s.isDebut || s.isAnniversary);

    if (birthday != null && prefs.getBool('birthday-confetti-$today') != true) {
      await prefs.setBool('birthday-confetti-$today', true);
      await Future.delayed(const Duration(milliseconds: 500));
      if (mounted) await showBirthdayCelebration(context, birthday);
    } else if (debut != null &&
        prefs.getBool('debut-confetti-$today') != true) {
      await prefs.setBool('debut-confetti-$today', true);
      await Future.delayed(const Duration(milliseconds: 500));
      if (mounted) await showDebutCelebration(context, debut);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheduleState = ref.watch(scheduleProvider);
    // 일정 로드 완료 시 축하 체크
    if (!scheduleState.isLoading && scheduleState.schedules.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _maybeCelebrate(scheduleState.schedules),
      );
    }
    final searchState = ref.watch(searchProvider);
    final suggestionState = ref.watch(suggestionProvider);
    final controller = ref.read(scheduleProvider.notifier);

    // 날짜가 변경되면 스크롤
    if (!_isSearchMode && _lastSelectedDate != scheduleState.selectedDate) {
      _lastSelectedDate = scheduleState.selectedDate;
      _playedCardKeys.clear(); // 날짜가 바뀌면 애니메이션 다시 1회 재생
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _scrollToSelectedDate(scheduleState.selectedDate);
      });
    }

    // 뒤로가기 키 처리 (유튜브 스타일)
    // 추천 검색어 화면 → 검색 결과 화면 (결과 있으면) → 일정 화면
    return PopScope(
      canPop: !_isSearchMode && !_showCalendar,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        if (_isSearchMode) {
          if (_showSuggestions && searchState.results.isNotEmpty) {
            _hideSuggestionsScreen();
          } else {
            _exitSearchMode();
          }
        } else if (_showCalendar) {
          _closeCalendar();
        }
      },
      child: ColoredBox(
        color: EColors.paper,
        child: Column(
          children: [
            // 툴바 (검색 모드 전환 애니메이션)
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 340),
              switchInCurve: Curves.easeInOutCubic,
              switchOutCurve: Curves.easeInOutCubic,
              transitionBuilder: (child, animation) =>
                  FadeTransition(opacity: animation, child: child),
              child: _isSearchMode
                  ? KeyedSubtree(
                      key: const ValueKey('search_toolbar'),
                      child: _buildSearchToolbar(),
                    )
                  : KeyedSubtree(
                      key: const ValueKey('normal_toolbar'),
                      child: _buildToolbar(scheduleState, controller),
                    ),
            ),
            // 고정 링크 패널 — 달력과 같은 자리·같은 애니메이션
            if (!_isSearchMode)
              ExpandFade(
                expanded: _showLinks,
                openDuration: const Duration(milliseconds: 250),
                closeDuration: const Duration(milliseconds: 250),
                curve: Curves.easeInOut,
                child: ScheduleLinkPanel(links: _links),
              ),

            // 툴바 아래 패널 — 웹 1:1
            //  · 열기/닫기: ExpandFade — height 0↔auto + opacity 동시(닫힐 때 페이드아웃하며
            //    접혀 빈 공간 없음). 열기(600)/닫기(440) 속도 분리.
            //  · cal↔ym: 내부 SlideUpCover(새 패널이 아래서 올라와 덮음) + AnimatedSize(높이 즉시 반영)
            if (!_isSearchMode)
              ExpandFade(
                expanded: _showCalendar,
                // 앱은 easeInOut + 웹보다 조금 빠르게(250ms)
                openDuration: const Duration(milliseconds: 250),
                closeDuration: const Duration(milliseconds: 250),
                curve: Curves.easeInOut,
                child: ClipRect(
                  child: AnimatedSize(
                    duration: const Duration(milliseconds: 460),
                    curve: Curves.easeInOutCubic,
                    alignment: Alignment.topCenter,
                    child: SlideUpCover(
                      duration: const Duration(milliseconds: 460),
                      child: _showYearMonthPicker
                          ? KeyedSubtree(
                              key: const ValueKey('ym'),
                              child: _buildYearMonthPanel(),
                            )
                          : KeyedSubtree(
                              key: const ValueKey('cal'),
                              child: _buildMonthGrid(scheduleState, controller),
                            ),
                    ),
                  ),
                ),
              ),
            // 스트립 + 필터 (즉시, 웹 {!showPanel && ...}) — 패널 접힘과 함께 위로 올라옴
            if (!_isSearchMode && !_showCalendar) ...[
              _buildDateSelector(scheduleState, controller),
              Container(height: 1, color: EColors.hairline),
              _buildCategoryFilter(scheduleState, controller),
            ],
            // 일정 목록, 추천 검색어, 또는 검색 결과 (전환·날짜 변경 시 부드러운 페이드업)
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 360),
                switchInCurve: Curves.easeInOutCubic,
                switchOutCurve: Curves.easeInOutCubic,
                transitionBuilder: (child, animation) => FadeTransition(
                  opacity: animation,
                  child: SlideTransition(
                    position: Tween<Offset>(
                      begin: const Offset(0, 0.03),
                      end: Offset.zero,
                    ).animate(animation),
                    child: child,
                  ),
                ),
                // 이전 자식을 남기지 않고 즉시 교체 (웹처럼) — 검색 진입 시 일정 목록이
                // 잠깐 보였다 사라지는 크로스페이드 잔상 제거. 새 자식만 페이드인.
                layoutBuilder: (currentChild, previousChildren) =>
                    currentChild ?? const SizedBox.shrink(),
                child: _isSearchMode
                    ? (_showSuggestions
                          ? KeyedSubtree(
                              key: const ValueKey('suggestions'),
                              child: _buildSuggestions(suggestionState),
                            )
                          : KeyedSubtree(
                              key: const ValueKey('search_results'),
                              child: _buildSearchResults(searchState),
                            ))
                    : KeyedSubtree(
                        // 키 고정: 날짜 변경 시 바깥 스위처는 재생하지 않고(헤더 유지),
                        // _buildScheduleList 안의 안쪽 EFadeUp이 목록만 날짜별로 재생 (웹과 동일)
                        key: const ValueKey('schedule_list'),
                        child: _buildScheduleList(scheduleState),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 툴바 빌드 — 에디토리얼 (‹ 2026. 7 ▼ › | 달력 · 검색)
  Widget _buildToolbar(ScheduleState state, ScheduleController controller) {
    final displayDate = _showCalendar ? _calendarViewDate : state.selectedDate;
    final canGoPrev =
        displayDate.year > _minYear ||
        (displayDate.year == _minYear && displayDate.month > 1);

    void goPrev() {
      if (_showCalendar) {
        _changeCalendarMonth(-1);
      } else {
        controller.changeMonth(-1);
      }
    }

    void goNext() {
      if (_showCalendar) {
        _changeCalendarMonth(1);
      } else {
        controller.changeMonth(1);
      }
    }

    return Container(
      color: EColors.paper,
      child: SafeArea(
        bottom: false,
        child: Container(
          height: 56,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          decoration: const BoxDecoration(
            border: Border(
              bottom: BorderSide(color: EColors.hairline, width: 1),
            ),
          ),
          child: Row(
            children: [
              // 이전 달
              _IconBtn(
                icon: Icons.chevron_left,
                color: canGoPrev ? EColors.mute : EColors.faint,
                onTap: canGoPrev ? goPrev : null,
              ),
              const SizedBox(width: 4),
              // 년월 타이틀 (달력 열림 시 ▼ 토글)
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: _showCalendar
                    ? () => setState(() {
                        _showYearMonthPicker = !_showYearMonthPicker;
                        _yearRangeStart =
                            _minYear +
                            ((_calendarViewDate.year - _minYear) ~/ 4) * 4;
                      })
                    : null,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '${displayDate.year}. ${displayDate.month}',
                      style: TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.5,
                        color: (_showCalendar && _showYearMonthPicker)
                            ? appPalette.primary
                            : EColors.ink,
                      ),
                    ),
                    if (_showCalendar) ...[
                      const SizedBox(width: 4),
                      AnimatedRotation(
                        turns: _showYearMonthPicker ? 0.5 : 0,
                        duration: const Duration(milliseconds: 200),
                        child: Text(
                          '▼',
                          style: TextStyle(
                            fontSize: 13,
                            color: appPalette.primary,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 4),
              // 다음 달
              _IconBtn(
                icon: Icons.chevron_right,
                color: EColors.mute,
                onTap: goNext,
              ),
              const Spacer(),
              // 고정 링크 토글 — 링크가 있을 때만 나온다
              if (_links.isNotEmpty) ...[
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    _IconBtn(
                      icon: LucideIcons.megaphone,
                      iconSize: 18,
                      color: _showLinks ? appPalette.primary : EColors.ebody,
                      onTap: _toggleLinks,
                    ),
                    // 마감이 일주일 이내인 항목이 있을 때만 점
                    if (!_showLinks && _links.any((l) => l.isUrgent))
                      Positioned(
                        right: -2,
                        top: -1,
                        child: Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            color: Color(0xFFC0392B),
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(width: 12),
              ],
              // 달력 토글 (lucide grid-3x3, PC와 동일)
              _IconBtn(
                icon: LucideIcons.grid,
                iconSize: 18,
                color: _showCalendar ? appPalette.primary : EColors.ebody,
                onTap: () => _showCalendar
                    ? _closeCalendar()
                    : _openCalendar(state.selectedDate),
              ),
              const SizedBox(width: 12),
              // 검색 (lucide search)
              _IconBtn(
                icon: LucideIcons.search,
                iconSize: 18,
                color: EColors.ebody,
                onTap: _enterSearchMode,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// 날짜 선택기 빌드 — 에디토리얼 (선택 = 잉크 블록)
  Widget _buildDateSelector(
    ScheduleState state,
    ScheduleController controller,
  ) {
    // 웹: 스트립 px-3 pt-3.5 pb-3, 셀 pt-2 pb-[9px], dow / mt-1 day / mt-[5px] dots(h-5)
    return SizedBox(
      height: 96,
      child: ListView.builder(
        controller: _dateScrollController,
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(12, 14, 12, 12),
        itemCount: state.daysInMonth.length,
        itemBuilder: (context, index) {
          final date = state.daysInMonth[index];
          final isSelected = controller.isSelected(date);
          final isToday = controller.isToday(date);
          final dow = date.weekday % 7; // 0=일 .. 6=토
          final daySchedules = state.getDaySchedules(date);

          Color dowColor() {
            if (isSelected) return Colors.white;
            if (dow == 0) return EColors.calSun;
            if (dow == 6) return EColors.calSat;
            return EColors.mute;
          }

          Color dayColor() {
            if (isSelected) return Colors.white;
            if (isToday) return appPalette.primary;
            if (dow == 0) return EColors.calSun;
            if (dow == 6) return EColors.calSat;
            return EColors.ink;
          }

          return GestureDetector(
            onTap: () => _onDateSelected(date),
            child: Container(
              width: 52,
              color: isSelected ? EColors.ink : Colors.transparent,
              padding: const EdgeInsets.only(top: 8, bottom: 9),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    weekdaysKo[dow],
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: dowColor(),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${date.day}',
                    style: TextStyle(
                      fontSize: 17.5,
                      fontWeight: FontWeight.w800,
                      height: 1.0,
                      color: dayColor(),
                    ),
                  ),
                  const SizedBox(height: 5),
                  SizedBox(
                    height: 5,
                    child: daySchedules.isNotEmpty
                        ? Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: daySchedules.map((schedule) {
                              return Container(
                                width: 5,
                                height: 5,
                                margin: const EdgeInsets.symmetric(
                                  horizontal: 1.5,
                                ),
                                decoration: BoxDecoration(
                                  color: parseColor(schedule.categoryColor),
                                  shape: BoxShape.circle,
                                  boxShadow: isSelected
                                      ? [
                                          BoxShadow(
                                            color: Colors.white.withValues(
                                              alpha: 0.9,
                                            ),
                                            spreadRadius: 1.5,
                                          ),
                                        ]
                                      : null,
                                ),
                              );
                            }).toList(),
                          )
                        : const SizedBox.shrink(),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  /// 일정 목록 빌드 — 에디토리얼 (날짜 헤딩 + 이벤트 행 + 특수 카드)
  Widget _buildScheduleList(ScheduleState state) {
    if (state.isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: EColors.ink, strokeWidth: 2.5),
      );
    }

    final dated = state.selectedDateSchedules;
    final undated = state.undatedSchedules;
    final sel = state.selectedDate;

    void openSchedule(Schedule s) {
      if (s.albumFolder != null) {
        context.push('/album/${s.albumFolder}');
      } else {
        context.push('/schedule/${s.id}');
      }
    }

    // 특수 카드는 py-2.5 (위아래 10) 래핑, 일반 행은 flat
    Widget buildEntry(Schedule s) {
      if (s.isBirthday) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: EBirthdayCard(schedule: s),
        );
      }
      if (s.isDebut || s.isAnniversary) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: EDebutCard(schedule: s),
        );
      }
      return EventRow(schedule: s, onTap: () => openSchedule(s));
    }

    return RefreshIndicator(
      onRefresh: () =>
          ref.read(scheduleProvider.notifier).loadSchedules(silent: true),
      color: EColors.ink,
      child: EFadeUp(
        // 바깥: 첫 로드 시 1회만 헤더+목록 페이드업 (웹 바깥 motion.div — 날짜 변경 시 재생 안 함)
        duration: const Duration(milliseconds: 420),
        fromY: 12,
        child: ListView(
          controller: _contentScrollController,
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          children: [
          // 날짜 헤딩 — "7. 12. SUNDAY" (첫 로드만, 날짜 변경 시 텍스트만 갱신)
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 24, 22, 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  '${sel.month}. ${sel.day}.',
                  style: const TextStyle(
                    fontSize: 30,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -1,
                    color: EColors.ink,
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  weekdaysKoFull[sel.weekday % 7],
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                    color: EColors.mute,
                  ),
                ),
              ],
            ),
          ),

          EFadeUp(
            // 안쪽: 날짜 변경마다 목록만 페이드업 (웹 안쪽 motion.div key=date)
            key: ValueKey('list_${sel.toIso8601String()}'),
            duration: const Duration(milliseconds: 420),
            fromY: 8,
            child: (dated.isEmpty && undated.isEmpty)
                ? Padding(
                    padding: const EdgeInsets.symmetric(vertical: 80),
                    child: Center(
                      child: Text(
                        '${sel.month}월 ${sel.day}일 일정이 없습니다',
                        style: const TextStyle(
                          fontSize: 14.5,
                          color: EColors.mute,
                        ),
                      ),
                    ),
                  )
                : Padding(
                    padding: const EdgeInsets.fromLTRB(22, 0, 22, 96),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        for (final s in dated) buildEntry(s),

                        // 날짜 미정 섹션
                        if (undated.isNotEmpty) ...[
                          Padding(
                            padding: const EdgeInsets.only(top: 26, bottom: 2),
                            child: Row(
                              children: [
                                Text(
                                  '날짜 미정 — ${sel.month}월 중',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 2,
                                    color: EColors.mute,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                const Expanded(child: DashedLine()),
                              ],
                            ),
                          ),
                          for (final s in undated)
                            EventRow(
                              schedule: s,
                              onTap: () => openSchedule(s),
                              dashed: true,
                              subtitleOverride:
                                  s.sourceName ?? '${sel.month}월 중 공개',
                            ),
                        ],
                      ],
                    ),
                  ),
          ),
        ],
        ),
      ),
    );
  }

  /// 카테고리 필터 칩 바 — 에디토리얼 (사각 보더, 선택 = 잉크)
  Widget _buildCategoryFilter(
    ScheduleState state,
    ScheduleController controller,
  ) {
    final categories = state.monthCategories;
    if (categories.isEmpty) return const SizedBox.shrink();
    final selected = state.selectedCategories;
    final total = categories.fold<int>(0, (sum, c) => sum + c.count);

    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: EColors.hairline, width: 1)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        child: Row(
          children: [
            _CatChip(
              label: '전체 $total',
              active: selected.isEmpty,
              onTap: controller.clearCategories,
            ),
            for (final cat in categories) ...[
              const SizedBox(width: 6),
              _CatChip(
                label: '${cat.name} ${cat.count}',
                active: selected.contains(cat.id),
                dotColor: parseColor(cat.color),
                onTap: () => controller.toggleCategory(cat.id),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// 툴바 아이콘 버튼
class _IconBtn extends StatelessWidget {
  final IconData icon;
  final Color color;
  final double iconSize;
  final VoidCallback? onTap;

  const _IconBtn({
    required this.icon,
    required this.color,
    this.iconSize = 24,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.all(4),
        child: Icon(icon, size: iconSize, color: color),
      ),
    );
  }
}

/// 카테고리 필터 칩
class _CatChip extends StatelessWidget {
  final String label;
  final bool active;
  final Color? dotColor;
  final VoidCallback onTap;

  const _CatChip({
    required this.label,
    required this.active,
    this.dotColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: active ? EColors.ink : Colors.transparent,
          border: Border.all(color: active ? EColors.ink : EColors.hairline),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (dotColor != null) ...[
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: active ? Colors.white : dotColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
                color: active ? Colors.white : EColors.esub,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 전폭 점선 (미정 섹션 구분)
