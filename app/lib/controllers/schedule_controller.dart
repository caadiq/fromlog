/// 일정 컨트롤러 (MVCS의 Controller 레이어)
///
/// 비즈니스 로직과 상태 관리를 담당합니다.
/// View는 이 Controller를 통해 데이터에 접근합니다.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/schedule.dart';
import '../services/schedules_service.dart';

/// 일정 상태
class ScheduleState {
  final DateTime selectedDate;
  final List<Schedule> schedules;
  final bool isLoading;
  final String? error;

  /// 선택된 카테고리 id 목록 (비어있으면 전체)
  final Set<int> selectedCategories;
  // 달력용 월별 일정 캐시 (key: "yyyy-MM")
  final Map<String, List<Schedule>> calendarCache;

  const ScheduleState({
    required this.selectedDate,
    this.schedules = const [],
    this.isLoading = false,
    this.error,
    this.calendarCache = const {},
    this.selectedCategories = const {},
  });

  /// 상태 복사 (불변성 유지)
  ScheduleState copyWith({
    DateTime? selectedDate,
    List<Schedule>? schedules,
    bool? isLoading,
    String? error,
    Map<String, List<Schedule>>? calendarCache,
    Set<int>? selectedCategories,
  }) {
    return ScheduleState(
      selectedDate: selectedDate ?? this.selectedDate,
      schedules: schedules ?? this.schedules,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      calendarCache: calendarCache ?? this.calendarCache,
      selectedCategories: selectedCategories ?? this.selectedCategories,
    );
  }

  /// 카테고리 필터 통과 여부 (특별 일정은 항상 통과)
  bool _passesCategory(Schedule s) {
    if (selectedCategories.isEmpty) return true;
    if (s.isSpecial) return true;
    return s.categoryId != null && selectedCategories.contains(s.categoryId);
  }

  /// 선택된 날짜의 일정 목록 (날짜 미정 제외)
  List<Schedule> get selectedDateSchedules {
    final dateStr = DateFormat('yyyy-MM-dd').format(selectedDate);
    return schedules
        .where(
          (s) =>
              !s.isUndated &&
              s.date.split('T')[0] == dateStr &&
              _passesCategory(s),
        )
        .toList();
  }

  /// 날짜 미정(월만 확정) 일정 — 선택 날짜와 무관하게 해당 달이면 하단 표시
  List<Schedule> get undatedSchedules {
    return schedules.where((s) => s.isUndated && _passesCategory(s)).toList();
  }

  /// 이번 달 카테고리 목록 (개수 내림차순, '기타'는 맨 뒤)
  List<({int id, String name, String color, int count})> get monthCategories {
    final map = <int, ({int id, String name, String color, int count})>{};
    for (final s in schedules) {
      if (s.isSpecial || s.categoryId == null) continue;
      final prev = map[s.categoryId!];
      map[s.categoryId!] = (
        id: s.categoryId!,
        name: s.categoryName ?? '미분류',
        color: s.categoryColor ?? '#9CA3AF',
        count: (prev?.count ?? 0) + 1,
      );
    }
    final list = map.values.toList()
      ..sort((a, b) {
        if (a.name == '기타') return 1;
        if (b.name == '기타') return -1;
        return b.count.compareTo(a.count);
      });
    return list;
  }

  /// 특정 날짜의 일정 (점 표시용, 최대 3개)
  /// 캐시에서 먼저 찾고, 없으면 현재 schedules에서 찾음
  List<Schedule> getDaySchedules(DateTime date) {
    final dateStr = DateFormat('yyyy-MM-dd').format(date);
    final cacheKey = DateFormat('yyyy-MM').format(date);

    // 캐시에 있으면 캐시에서 가져옴 (날짜 미정은 점 표시 제외)
    if (calendarCache.containsKey(cacheKey)) {
      return calendarCache[cacheKey]!
          .where(
            (s) =>
                !s.isUndated &&
                s.date.split('T')[0] == dateStr &&
                _passesCategory(s),
          )
          .take(3)
          .toList();
    }

    // 캐시에 없으면 현재 schedules에서 찾음
    return schedules
        .where(
          (s) =>
              !s.isUndated &&
              s.date.split('T')[0] == dateStr &&
              _passesCategory(s),
        )
        .take(3)
        .toList();
  }

  /// 특정 월의 일정이 캐시에 있는지 확인
  bool hasMonthCache(int year, int month) {
    final cacheKey = '$year-${month.toString().padLeft(2, '0')}';
    return calendarCache.containsKey(cacheKey);
  }

  /// 해당 달의 모든 날짜 배열
  List<DateTime> get daysInMonth {
    final year = selectedDate.year;
    final month = selectedDate.month;
    final lastDay = DateTime(year, month + 1, 0).day;
    return List.generate(lastDay, (i) => DateTime(year, month, i + 1));
  }
}

/// 일정 컨트롤러
class ScheduleController extends Notifier<ScheduleState> {
  int _nextRequestId = 0;
  int _latestForegroundRequestId = 0;
  final Map<String, int> _monthRequests = {};

  String _monthKey(DateTime date) =>
      '${date.year}-${date.month.toString().padLeft(2, '0')}';

  bool _isCurrentRequest(int requestId, String cacheKey) =>
      ref.mounted && _monthRequests[cacheKey] == requestId;

  bool _isVisibleRequest(int requestId, String cacheKey) =>
      _latestForegroundRequestId == requestId &&
      _monthKey(state.selectedDate) == cacheKey;

  @override
  ScheduleState build() {
    final initialRequestId = ++_nextRequestId;
    _latestForegroundRequestId = initialRequestId;
    ref.onDispose(() {
      _latestForegroundRequestId = ++_nextRequestId;
      _monthRequests.clear();
    });
    Future.microtask(() {
      if (ref.mounted && _latestForegroundRequestId == initialRequestId) {
        loadSchedules();
      }
    });
    return ScheduleState(selectedDate: DateTime.now());
  }

  /// 월별 일정 로드
  /// [silent] true면 isLoading 토글 없이 로드 (당겨서 새로고침 — 기존 목록 유지)
  Future<void> loadSchedules({bool silent = false}) async {
    final date = state.selectedDate;
    final cacheKey = _monthKey(date);
    final requestId = ++_nextRequestId;
    _latestForegroundRequestId = requestId;
    _monthRequests[cacheKey] = requestId;
    if (!silent) state = state.copyWith(isLoading: true, error: null);

    try {
      final schedules = await getSchedules(date.year, date.month);
      if (!_isCurrentRequest(requestId, cacheKey)) return;
      final newCache = {...state.calendarCache, cacheKey: schedules};
      if (_isVisibleRequest(requestId, cacheKey)) {
        state = state.copyWith(
          schedules: schedules,
          isLoading: false,
          calendarCache: newCache,
        );
      } else {
        // Cache late responses only under their original month.
        state = state.copyWith(calendarCache: newCache, error: state.error);
      }
    } catch (e) {
      if (_isCurrentRequest(requestId, cacheKey) &&
          _isVisibleRequest(requestId, cacheKey)) {
        state = state.copyWith(isLoading: false, error: e.toString());
      }
    } finally {
      if (_monthRequests[cacheKey] == requestId) {
        _monthRequests.remove(cacheKey);
      }
    }
  }

  /// 달력용 특정 월의 일정 비동기 로드 (UI 블로킹 없음)
  Future<void> loadCalendarMonth(int year, int month) async {
    final date = DateTime(year, month);
    final cacheKey = _monthKey(date);
    if (state.calendarCache.containsKey(cacheKey) ||
        _monthRequests.containsKey(cacheKey)) {
      return;
    }
    final requestId = ++_nextRequestId;
    _monthRequests[cacheKey] = requestId;

    try {
      final schedules = await getSchedules(date.year, date.month);
      if (!_isCurrentRequest(requestId, cacheKey)) return;
      state = state.copyWith(
        calendarCache: {...state.calendarCache, cacheKey: schedules},
        error: state.error,
      );
    } catch (_) {
      // Prefetch failures must not change foreground loading or errors.
    } finally {
      if (_monthRequests[cacheKey] == requestId) {
        _monthRequests.remove(cacheKey);
      }
    }
  }

  /// 날짜 선택
  /// 카테고리 필터 토글
  void toggleCategory(int categoryId) {
    final next = Set<int>.from(state.selectedCategories);
    if (!next.remove(categoryId)) next.add(categoryId);
    state = state.copyWith(selectedCategories: next);
  }

  /// 카테고리 필터 초기화 (전체)
  void clearCategories() {
    state = state.copyWith(selectedCategories: const {});
  }

  void selectDate(DateTime date) {
    state = state.copyWith(selectedDate: date);
  }

  /// 월 변경
  void changeMonth(int delta) {
    final newDate = DateTime(
      state.selectedDate.year,
      state.selectedDate.month + delta,
      1,
    );
    final today = DateTime.now();

    // 이번 달이면 오늘 날짜, 다른 달이면 1일 선택
    final selectedDay =
        (newDate.year == today.year && newDate.month == today.month)
        ? today.day
        : 1;

    goToDate(DateTime(newDate.year, newDate.month, selectedDay));
  }

  /// 특정 날짜로 이동 (달력에서 선택 시)
  void goToDate(DateTime date) {
    final monthChanged = _monthKey(date) != _monthKey(state.selectedDate);
    state = state.copyWith(
      selectedDate: date,
      schedules: monthChanged
          ? state.calendarCache[_monthKey(date)] ?? const []
          : state.schedules,
    );
    if (monthChanged) loadSchedules();
  }

  /// 오늘 여부
  bool isToday(DateTime date) {
    final today = DateTime.now();
    return date.year == today.year &&
        date.month == today.month &&
        date.day == today.day;
  }

  /// 선택된 날짜 여부
  bool isSelected(DateTime date) {
    return date.year == state.selectedDate.year &&
        date.month == state.selectedDate.month &&
        date.day == state.selectedDate.day;
  }
}

/// 일정 Provider
final scheduleProvider = NotifierProvider<ScheduleController, ScheduleState>(
  ScheduleController.new,
);

/// 검색 상태
class SearchState {
  final String searchTerm;
  final List<Schedule> results;
  final bool isLoading;
  final bool isFetchingMore;
  final bool hasMore;
  final int offset;
  final String? error;

  const SearchState({
    this.searchTerm = '',
    this.results = const [],
    this.isLoading = false,
    this.isFetchingMore = false,
    this.hasMore = true,
    this.offset = 0,
    this.error,
  });

  SearchState copyWith({
    String? searchTerm,
    List<Schedule>? results,
    bool? isLoading,
    bool? isFetchingMore,
    bool? hasMore,
    int? offset,
    String? error,
  }) {
    return SearchState(
      searchTerm: searchTerm ?? this.searchTerm,
      results: results ?? this.results,
      isLoading: isLoading ?? this.isLoading,
      isFetchingMore: isFetchingMore ?? this.isFetchingMore,
      hasMore: hasMore ?? this.hasMore,
      offset: offset ?? this.offset,
      error: error,
    );
  }
}

/// 검색 컨트롤러
class ScheduleSearchController extends Notifier<SearchState> {
  static const int _pageSize = 20;
  int _generation = 0;

  bool _isCurrent(int generation) => ref.mounted && generation == _generation;

  @override
  SearchState build() {
    _generation++;
    ref.onDispose(() => _generation++);
    return const SearchState();
  }

  /// 검색 실행
  Future<void> search(String query) async {
    if (query.trim().isEmpty) {
      clear();
      return;
    }

    final generation = ++_generation;
    state = SearchState(searchTerm: query, isLoading: true);

    try {
      final result = await searchSchedules(query, offset: 0, limit: _pageSize);
      if (!_isCurrent(generation)) return;
      state = state.copyWith(
        results: result.schedules,
        isLoading: false,
        hasMore: result.hasMore,
        offset: result.schedules.length,
      );
    } catch (e) {
      if (!_isCurrent(generation)) return;
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  /// 다음 페이지 로드
  Future<void> loadMore() async {
    if (state.isLoading ||
        state.isFetchingMore ||
        !state.hasMore ||
        state.searchTerm.isEmpty) {
      return;
    }

    final generation = _generation;
    final query = state.searchTerm;
    final offset = state.offset;
    state = state.copyWith(isFetchingMore: true);

    try {
      final result = await searchSchedules(
        query,
        offset: offset,
        limit: _pageSize,
      );
      if (!_isCurrent(generation)) return;
      state = state.copyWith(
        results: [...state.results, ...result.schedules],
        isFetchingMore: false,
        hasMore: result.hasMore,
        offset: offset + result.schedules.length,
      );
    } catch (e) {
      if (!_isCurrent(generation)) return;
      state = state.copyWith(isFetchingMore: false, error: e.toString());
    }
  }

  /// 검색 초기화
  void clear() {
    _generation++;
    state = const SearchState();
  }
}

/// 검색 Provider
final searchProvider = NotifierProvider<ScheduleSearchController, SearchState>(
  ScheduleSearchController.new,
);

/// 추천 검색어 상태
class SuggestionState {
  final String query;
  final List<String> suggestions;
  final bool isLoading;

  const SuggestionState({
    this.query = '',
    this.suggestions = const [],
    this.isLoading = false,
  });

  SuggestionState copyWith({
    String? query,
    List<String>? suggestions,
    bool? isLoading,
  }) {
    return SuggestionState(
      query: query ?? this.query,
      suggestions: suggestions ?? this.suggestions,
      isLoading: isLoading ?? this.isLoading,
    );
  }
}

/// 추천 검색어 컨트롤러
class SuggestionController extends Notifier<SuggestionState> {
  int _generation = 0;

  bool _isCurrent(int generation) => ref.mounted && generation == _generation;

  @override
  SuggestionState build() {
    _generation++;
    ref.onDispose(() => _generation++);
    return const SuggestionState();
  }

  /// 추천 검색어 로드
  Future<void> loadSuggestions(String query) async {
    if (query.trim().isEmpty) {
      clear();
      return;
    }

    // 같은 쿼리면 스킵
    if (state.query == query &&
        (state.isLoading || state.suggestions.isNotEmpty)) {
      return;
    }

    final generation = ++_generation;
    state = SuggestionState(query: query, isLoading: true);

    try {
      final suggestions = await getSuggestions(query, limit: 10);
      if (!_isCurrent(generation)) return;
      state = state.copyWith(suggestions: suggestions, isLoading: false);
    } catch (e) {
      if (!_isCurrent(generation)) return;
      state = state.copyWith(suggestions: [], isLoading: false);
    }
  }

  /// 추천 검색어 초기화
  void clear() {
    _generation++;
    state = const SuggestionState();
  }
}

/// 추천 검색어 Provider
final suggestionProvider =
    NotifierProvider<SuggestionController, SuggestionState>(
      SuggestionController.new,
    );

/// 최근 검색기록 상태
class RecentSearchState {
  final List<String> searches;

  const RecentSearchState({this.searches = const []});

  RecentSearchState copyWith({List<String>? searches}) {
    return RecentSearchState(searches: searches ?? this.searches);
  }
}

/// 최근 검색기록 컨트롤러
class RecentSearchController extends Notifier<RecentSearchState> {
  static const int _maxHistory = 10;

  @override
  RecentSearchState build() {
    _loadFromStorage();
    return const RecentSearchState();
  }

  /// SharedPreferences에서 로드
  Future<void> _loadFromStorage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final searches = prefs.getStringList('recent_searches');
      if (searches != null) {
        state = state.copyWith(searches: searches);
      }
    } catch (e) {
      // 로드 실패 시 무시
    }
  }

  /// 검색어 추가
  Future<void> addSearch(String query) async {
    if (query.trim().isEmpty) return;

    final trimmed = query.trim();
    final newSearches = [
      trimmed,
      ...state.searches.where((s) => s != trimmed),
    ].take(_maxHistory).toList();

    state = state.copyWith(searches: newSearches);

    // SharedPreferences에 저장
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList('recent_searches', newSearches);
    } catch (e) {
      // 저장 실패 시 무시
    }
  }

  /// 특정 검색어 삭제
  Future<void> removeSearch(String query) async {
    final newSearches = state.searches.where((s) => s != query).toList();
    state = state.copyWith(searches: newSearches);

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList('recent_searches', newSearches);
    } catch (e) {
      // 저장 실패 시 무시
    }
  }

  /// 전체 삭제
  Future<void> clearAll() async {
    state = const RecentSearchState();

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList('recent_searches', []);
    } catch (e) {
      // 저장 실패 시 무시
    }
  }
}

/// 최근 검색기록 Provider
final recentSearchProvider =
    NotifierProvider<RecentSearchController, RecentSearchState>(
      RecentSearchController.new,
    );
