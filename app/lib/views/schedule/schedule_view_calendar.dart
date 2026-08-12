/// 일정 화면 — 인라인 달력 파트 (schedule_view.dart의 part)
///
/// 웹 CalendarPanel / YearMonthPanel 대응. 오버레이가 아니라 툴바 아래로
/// 펼쳐지며 일정 목록을 밀어낸다.
part of 'schedule_view.dart';

extension _ScheduleCalendarPart on _ScheduleViewState {
  /// PageView 페이지 ↔ 월 매핑 기준 (오늘)
  int _pageForDate(DateTime date) {
    final now = DateTime.now();
    final delta = (date.year - now.year) * 12 + (date.month - now.month);
    return _ScheduleViewState._initialPage + delta;
  }

  DateTime _dateForPage(int page) {
    final now = DateTime.now();
    final delta = page - _ScheduleViewState._initialPage;
    return DateTime(now.year, now.month + delta, 1);
  }

  /// 달력 열기
  void _openCalendar(DateTime initialDate) {
    _refresh(() {
      _calendarViewDate = DateTime(initialDate.year, initialDate.month, 1);
      _showCalendar = true;
      _showYearMonthPicker = false;
      _showLinks = false; // 두 패널이 동시에 열리지 않게
    });
    ref
        .read(scheduleProvider.notifier)
        .loadCalendarMonth(initialDate.year, initialDate.month);
    // PageView를 해당 월로 정렬
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _calendarPageController.hasClients) {
        _calendarPageController.jumpToPage(_pageForDate(initialDate));
      }
    });
  }

  /// 달력 닫기 — 닫힘 애니메이션이 끝난 뒤 날짜 스트립을 선택 날짜로 부드럽게 스크롤
  void _closeCalendar() {
    _refresh(() {
      _showCalendar = false;
      _showYearMonthPicker = false;
    });
    final selectedDate = ref.read(scheduleProvider).selectedDate;
    // 접힘(250ms) 후반에 겹쳐 시작 → 닫히자마자 이어지는 느낌
    Future.delayed(const Duration(milliseconds: 150), () {
      if (mounted) _scrollToSelectedDate(selectedDate);
    });
  }

  /// 달력 뷰 월 변경 (툴바 화살표) — PageView 애니메이션으로 위임
  void _changeCalendarMonth(int delta) {
    final next = DateTime(
      _calendarViewDate.year,
      _calendarViewDate.month + delta,
      1,
    );
    if (next.year < _ScheduleViewState._minYear) return;
    if (_calendarPageController.hasClients) {
      _calendarPageController.animateToPage(
        _pageForDate(next),
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    } else {
      _refresh(() => _calendarViewDate = next);
      ref.read(scheduleProvider.notifier).loadCalendarMonth(next.year, next.month);
    }
  }

  /// 년월 픽커에서 월/년 선택 시 PageView 동기화
  void _syncCalendarPage(DateTime date) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _calendarPageController.hasClients) {
        _calendarPageController.jumpToPage(_pageForDate(date));
      }
    });
  }

  /// 특정 월의 42칸(6주) 셀 생성
  List<({DateTime date, bool outside})> _monthCells(int year, int month) {
    final first = DateTime(year, month, 1);
    final startDow = first.weekday % 7; // 0=일
    final lastDay = DateTime(year, month + 1, 0).day;
    final cells = <({DateTime date, bool outside})>[];
    for (var i = 0; i < startDow; i++) {
      cells.add((date: DateTime(year, month, i - startDow + 1), outside: true));
    }
    for (var d = 1; d <= lastDay; d++) {
      cells.add((date: DateTime(year, month, d), outside: false));
    }
    while (cells.length % 7 != 0) {
      final last = cells.last.date;
      cells.add((
        date: DateTime(last.year, last.month, last.day + 1),
        outside: true,
      ));
    }
    return cells;
  }

  /// 월 그리드 (웹 CalendarPanel, bg white) — PageView 좌우 스와이프
  Widget _buildMonthGrid(ScheduleState state, ScheduleController controller) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: EColors.hairline, width: 1)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 요일 헤더
          Row(
            children: List.generate(7, (i) {
              return Expanded(
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 7),
                    child: Text(
                      weekdaysKo[i],
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: i == 0
                            ? EColors.calSun
                            : i == 6
                                ? EColors.calSat
                                : EColors.mute,
                      ),
                    ),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 4),
          // 월 스와이프 (드래그 따라오는 PageView, 높이 자동)
          ExpandablePageView.builder(
            controller: _calendarPageController,
            itemCount: _ScheduleViewState._initialPage * 2,
            onPageChanged: (page) {
              final date = _dateForPage(page);
              _refresh(() => _calendarViewDate = date);
              ref
                  .read(scheduleProvider.notifier)
                  .loadCalendarMonth(date.year, date.month);
            },
            itemBuilder: (context, page) {
              final date = _dateForPage(page);
              if (!state.hasMonthCache(date.year, date.month)) {
                controller.loadCalendarMonth(date.year, date.month);
              }
              return _buildDaysGrid(date, state, controller);
            },
          ),
          const SizedBox(height: 14),
          // 오늘 버튼
          GestureDetector(
            onTap: () {
              final today = DateTime.now();
              controller.goToDate(today);
              if (_contentScrollController.hasClients) {
                _contentScrollController.jumpTo(0);
              }
              _closeCalendar();
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 8),
              decoration: BoxDecoration(border: Border.all(color: appPalette.primary)),
              child:  Text(
                '오늘',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 2,
                  color: appPalette.primary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 한 달치 날짜 그리드
  Widget _buildDaysGrid(
    DateTime month,
    ScheduleState state,
    ScheduleController controller,
  ) {
    final cells = _monthCells(month.year, month.month);
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.only(top: 4),
      // 웹 CalendarPanel 셀은 aspect-square — 선택 배경이 정사각형
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 7,
        mainAxisSpacing: 4,
        childAspectRatio: 1,
      ),
      itemCount: cells.length,
      itemBuilder: (context, index) {
        final cell = cells[index];
        final date = cell.date;
        final outside = cell.outside;
        final dow = index % 7;
        final sel = !outside && controller.isSelected(date);
        final today = !outside && controller.isToday(date);
        final dots = outside ? <Schedule>[] : state.getDaySchedules(date);

        Color dayColor() {
          if (outside) return EColors.faintLight;
          if (sel) return Colors.white;
          if (dow == 0) return EColors.calSun;
          if (dow == 6) return EColors.calSat;
          return EColors.ebody;
        }

        return GestureDetector(
          onTap: outside
              ? null
              : () {
                  controller.goToDate(date);
                  if (_contentScrollController.hasClients) {
                    _contentScrollController.jumpTo(0);
                  }
                  _closeCalendar();
                },
          child: Container(
            decoration: BoxDecoration(
              color: sel ? EColors.ink : Colors.transparent,
              border: (today && !sel)
                  ? Border.all(color: appPalette.primary, width: 1.5)
                  : null,
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  '${date.day}',
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: dayColor(),
                  ),
                ),
                const SizedBox(height: 3),
                SizedBox(
                  height: 5,
                  child: dots.isNotEmpty
                      ? Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: dots.map((s) {
                            return Container(
                              width: 5,
                              height: 5,
                              margin: const EdgeInsets.symmetric(horizontal: 1.5),
                              decoration: BoxDecoration(
                                color: parseColor(s.categoryColor),
                                shape: BoxShape.circle,
                                boxShadow: sel
                                    ? [
                                        BoxShadow(
                                          color: Colors.white.withValues(alpha: 0.9),
                                          spreadRadius: 1.5,
                                        ),
                                      ]
                                    : null,
                              ),
                            );
                          }).toList(),
                        )
                      : null,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  /// 년월 픽커 (웹 YearMonthPanel — 4년 단위)
  Widget _buildYearMonthPanel() {
    final now = DateTime.now();
    final years = List.generate(4, (i) => _yearRangeStart + i);

    Widget cell({
      required String label,
      required bool selected,
      required bool isNow,
      required VoidCallback onTap,
    }) {
      return GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 13),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? EColors.ink : Colors.transparent,
            border: Border.all(
              color: selected
                  ? EColors.ink
                  : isNow
                      ? appPalette.primary
                      : EColors.hairline,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: selected
                  ? Colors.white
                  : isNow
                      ? appPalette.primary
                      : EColors.ebody,
            ),
          ),
        ),
      );
    }

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: EColors.hairline, width: 1)),
      ),
      padding: const EdgeInsets.fromLTRB(22, 22, 22, 26),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 년도 범위 헤더
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              GestureDetector(
                onTap: _yearRangeStart <= _ScheduleViewState._minYear
                    ? null
                    : () => _refresh(() => _yearRangeStart -= 4),
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.all(4),
                  child: Icon(
                    Icons.chevron_left,
                    size: 18,
                    color: _yearRangeStart <= _ScheduleViewState._minYear
                        ? EColors.faint
                        : EColors.esub,
                  ),
                ),
              ),
              Text(
                '${years.first} — ${years.last}',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1,
                  color: EColors.ink,
                ),
              ),
              GestureDetector(
                onTap: () => _refresh(() => _yearRangeStart += 4),
                behavior: HitTestBehavior.opaque,
                child: const Padding(
                  padding: EdgeInsets.all(4),
                  child: Icon(Icons.chevron_right, size: 18, color: EColors.esub),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Text(
            'YEAR',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              letterSpacing: 2.5,
              color: EColors.mute,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              for (var i = 0; i < years.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: cell(
                    label: '${years[i]}',
                    selected: years[i] == _calendarViewDate.year,
                    isNow: years[i] == now.year,
                    onTap: () {
                      final next =
                          DateTime(years[i], _calendarViewDate.month, 1);
                      _refresh(() => _calendarViewDate = next);
                      _syncCalendarPage(next);
                    },
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 14),
          const Text(
            'MONTH',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              letterSpacing: 2.5,
              color: EColors.mute,
            ),
          ),
          const SizedBox(height: 10),
          // 웹: grid-cols-4 gap-2, 셀 높이=내용 (aspectRatio 미사용) → 3행 Row
          for (var r = 0; r < 3; r++) ...[
            if (r > 0) const SizedBox(height: 8),
            Row(
              children: [
                for (var c = 0; c < 4; c++) ...[
                  if (c > 0) const SizedBox(width: 8),
                  Expanded(
                    child: Builder(
                      builder: (context) {
                        final month = r * 4 + c + 1;
                        return cell(
                          label: '$month',
                          selected: month == _calendarViewDate.month,
                          isNow: month == now.month &&
                              _calendarViewDate.year == now.year,
                          onTap: () {
                            final next =
                                DateTime(_calendarViewDate.year, month, 1);
                            _refresh(() {
                              _calendarViewDate = next;
                              _showYearMonthPicker = false;
                            });
                            _syncCalendarPage(next);
                            ref
                                .read(scheduleProvider.notifier)
                                .loadCalendarMonth(next.year, next.month);
                          },
                        );
                      },
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
