/// 일정 화면 — 검색 파트 (schedule_view.dart의 part)
///
/// 검색 모드 진입/종료·추천/최근 검색·검색 결과 UI.
/// _ScheduleViewState의 private 상태를 그대로 사용한다.
part of 'schedule_view.dart';

extension _ScheduleSearchPart on _ScheduleViewState {
  /// 검색 스크롤 리스너 (무한 스크롤)
  void _onSearchScroll() {
    // 스크롤이 끝에서 500px 전에 다음 페이지 미리 로드
    if (_searchScrollController.position.pixels >=
        _searchScrollController.position.maxScrollExtent - 500) {
      ref.read(searchProvider.notifier).loadMore();
    }
  }

  /// 검색 모드 진입
  void _enterSearchMode() {
    _refresh(() {
      _isSearchMode = true;
      _showSuggestions = true;
      _showLinks = false;
    });
    // 검색 입력창 포커스
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _searchFocusNode.requestFocus();
    });
  }

  /// 검색 모드 종료
  void _exitSearchMode() {
    _debounceTimer?.cancel();
    _refresh(() {
      _isSearchMode = false;
      _showSuggestions = false;
      _searchInputController.clear();
    });
    ref.read(searchProvider.notifier).clear();
    ref.read(suggestionProvider.notifier).clear();
    _searchFocusNode.unfocus();
    // 검색 종료 시 선택된 날짜로 스크롤
    final selectedDate = ref.read(scheduleProvider).selectedDate;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollToSelectedDate(selectedDate);
    });
  }

  /// 추천 검색어 화면 표시 (유튜브 스타일)
  void _showSuggestionsScreen() {
    _refresh(() {
      _showSuggestions = true;
    });
    _searchFocusNode.requestFocus();
  }

  /// 추천 검색어 화면에서 뒤로가기 (검색 결과가 있으면 결과 화면으로)
  void _hideSuggestionsScreen() {
    final searchState = ref.read(searchProvider);
    if (searchState.results.isNotEmpty) {
      // 검색 결과가 있으면 결과 화면으로 (검색어 복원)
      _refresh(() {
        _showSuggestions = false;
        _searchInputController.text = _lastSearchTerm;
      });
      _searchFocusNode.unfocus();
    } else {
      // 검색 결과가 없으면 검색 모드 종료
      _exitSearchMode();
    }
  }

  /// 검색 실행
  void _onSearch(String query) {
    if (query.trim().isNotEmpty) {
      _lastSearchTerm = query; // 검색어 저장
      ref.read(searchProvider.notifier).search(query);
      ref.read(recentSearchProvider.notifier).addSearch(query); // 최근 검색기록 저장
      _refresh(() {
        _showSuggestions = false;
      });
      _searchFocusNode.unfocus();
    }
  }

  /// 검색어 입력 변경 (디바운스로 추천 검색어 로드)
  void _onSearchInputChanged(String value) {
    _refresh(() {}); // X 버튼 표시 갱신

    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 200), () {
      if (value.trim().isNotEmpty) {
        ref.read(suggestionProvider.notifier).loadSuggestions(value);
      } else {
        ref.read(suggestionProvider.notifier).clear();
      }
    });
  }

  /// 검색 툴바 빌드
  Widget _buildSearchToolbar() {
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
              // 뒤로가기
              GestureDetector(
                onTap: _exitSearchMode,
                behavior: HitTestBehavior.opaque,
                child: const Padding(
                  padding: EdgeInsets.only(right: 14),
                  child: Icon(Icons.arrow_back, size: 22, color: EColors.mute),
                ),
              ),
              // 밑줄 검색 입력창
              Expanded(
                child: Container(
                  decoration: const BoxDecoration(
                    border: Border(
                      bottom: BorderSide(color: EColors.ink, width: 2),
                    ),
                  ),
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _searchInputController,
                          focusNode: _searchFocusNode,
                          style: const TextStyle(
                            fontFamily: 'Pretendard',
                            fontSize: 17.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.3,
                            color: EColors.ink,
                          ),
                          decoration: const InputDecoration(
                            hintText: '검색어 입력',
                            hintStyle: TextStyle(
                              fontFamily: 'Pretendard',
                              fontSize: 17.5,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.3,
                              color: EColors.faintLight,
                            ),
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.zero,
                            isDense: true,
                          ),
                          textInputAction: TextInputAction.search,
                          onTap: () {
                            if (!_showSuggestions) {
                              _showSuggestionsScreen();
                            }
                          },
                          onChanged: _onSearchInputChanged,
                          onSubmitted: _onSearch,
                        ),
                      ),
                      if (_searchInputController.text.isNotEmpty)
                        GestureDetector(
                          onTap: () {
                            _refresh(() {
                              _searchInputController.clear();
                              _showSuggestions = true;
                            });
                            ref.read(suggestionProvider.notifier).clear();
                            _searchFocusNode.requestFocus();
                          },
                          child: const Padding(
                            padding: EdgeInsets.only(left: 8),
                            child: Icon(
                              Icons.close,
                              size: 17,
                              color: EColors.mute,
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
    );
  }

  /// 추천 검색어 빌드 (유튜브 스타일)
  Widget _buildSuggestions(SuggestionState suggestionState) {
    final recentSearchState = ref.watch(recentSearchProvider);

    // 입력값이 없을 때 - 최근 검색기록 표시
    if (_searchInputController.text.isEmpty) {
      if (recentSearchState.searches.isEmpty) {
        return Padding(
          padding: const EdgeInsets.only(top: 100),
          child: Align(
            alignment: Alignment.topCenter,
            child: Text(
              '검색어를 입력하세요',
              style: const TextStyle(
                fontFamily: 'Pretendard',
                fontSize: 14,
                color: EColors.mute,
              ),
            ),
          ),
        );
      }
      // 최근 검색기록 목록
      return _buildRecentSearches(recentSearchState.searches);
    }

    // 추천 검색어 없음
    if (suggestionState.suggestions.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(top: 100),
        child: Align(
          alignment: Alignment.topCenter,
          child: Text(
            '추천 검색어가 없습니다',
            style: const TextStyle(
              fontFamily: 'Pretendard',
              fontSize: 14,
              color: EColors.mute,
            ),
          ),
        ),
      );
    }

    // 추천 검색어 목록
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: suggestionState.suggestions.length,
      itemBuilder: (context, index) {
        final suggestion = suggestionState.suggestions[index];
        return GestureDetector(
          onTap: () {
            _searchInputController.text = suggestion;
            _onSearch(suggestion);
          },
          behavior: HitTestBehavior.opaque,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(color: EColors.hairline, width: 1),
              ),
            ),
            child: Row(
              children: [
                const Icon(Icons.search, size: 18, color: EColors.mute),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    suggestion,
                    style: const TextStyle(
                      fontFamily: 'Pretendard',
                      fontSize: 15,
                      color: EColors.ink,
                    ),
                  ),
                ),
                // 화살표 아이콘 (검색어를 입력창에 채우기)
                GestureDetector(
                  onTap: () {
                    _searchInputController.text = suggestion;
                    _searchInputController.selection =
                        TextSelection.fromPosition(
                          TextPosition(offset: suggestion.length),
                        );
                    _onSearchInputChanged(suggestion);
                  },
                  child: const Padding(
                    padding: EdgeInsets.all(4),
                    child: Icon(
                      Icons.north_west,
                      size: 16,
                      color: EColors.mute,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  /// 최근 검색기록 빌드 — 웹 에디토리얼 RECENT와 동일
  Widget _buildRecentSearches(List<String> searches) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // RECENT 헤더 + 전체 삭제
        Padding(
          padding: const EdgeInsets.fromLTRB(22, 22, 22, 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'RECENT',
                style: TextStyle(
                  fontFamily: 'Pretendard',
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 2.5,
                  color: EColors.ink,
                ),
              ),
              GestureDetector(
                onTap: () => ref.read(recentSearchProvider.notifier).clearAll(),
                child: const Text(
                  '전체 삭제',
                  style: TextStyle(
                    fontFamily: 'Pretendard',
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: EColors.mute,
                  ),
                ),
              ),
            ],
          ),
        ),
        // 상단 2px 잉크 룰 + 목록
        Expanded(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 22),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: EColors.ink, width: 2)),
            ),
            child: ListView.builder(
              padding: EdgeInsets.zero,
              itemCount: searches.length,
              itemBuilder: (context, index) {
                final search = searches[index];
                return DecoratedBox(
                  decoration: const BoxDecoration(
                    border: Border(
                      bottom: BorderSide(color: EColors.hairline, width: 1),
                    ),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () {
                            _searchInputController.text = search;
                            _onSearch(search);
                          },
                          behavior: HitTestBehavior.opaque,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 2,
                              vertical: 15,
                            ),
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.access_time,
                                  size: 16,
                                  color: EColors.mute,
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Text(
                                    search,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontFamily: 'Pretendard',
                                      fontSize: 15,
                                      fontWeight: FontWeight.w600,
                                      color: EColors.ink,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      GestureDetector(
                        onTap: () => ref
                            .read(recentSearchProvider.notifier)
                            .removeSearch(search),
                        child: const Padding(
                          padding: EdgeInsets.all(6),
                          child: Icon(
                            Icons.close,
                            size: 15,
                            color: EColors.faint,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ),
      ],
    );
  }

  /// 검색 결과 빌드
  Widget _buildSearchResults(SearchState searchState) {
    // 검색어가 없을 때
    if (searchState.searchTerm.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(top: 100),
        child: Align(
          alignment: Alignment.topCenter,
          child: Text(
            '검색어를 입력하세요',
            style: const TextStyle(
              fontFamily: 'Pretendard',
              fontSize: 14,
              color: EColors.mute,
            ),
          ),
        ),
      );
    }

    // 로딩 중
    if (searchState.isLoading) {
      return Padding(
        padding: const EdgeInsets.only(top: 100),
        child: Align(
          alignment: Alignment.topCenter,
          child: const CircularProgressIndicator(color: EColors.ink),
        ),
      );
    }

    // 검색 결과 없음
    if (searchState.results.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(top: 100),
        child: Align(
          alignment: Alignment.topCenter,
          child: Text(
            '검색 결과가 없습니다',
            style: const TextStyle(
              fontFamily: 'Pretendard',
              fontSize: 14,
              color: EColors.mute,
            ),
          ),
        ),
      );
    }

    // 검색 결과 목록 — 에디토리얼 (RESULTS 헤딩 + 행/특수카드)
    final term = searchState.searchTerm;
    return ListView.builder(
      key: ValueKey('search_list_$term'),
      controller: _searchScrollController,
      padding: const EdgeInsets.fromLTRB(22, 0, 22, 64),
      // 헤더(1) + 결과 + 하단 푸터(1: 스피너 또는 '모두 로드됨')
      itemCount: searchState.results.length + 2,
      itemBuilder: (context, index) {
        // 헤더 (RESULTS + 건수 + 상단 2px 룰)
        if (index == 0) {
          return Padding(
            padding: const EdgeInsets.only(top: 22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      const Text(
                        'RESULTS',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 2.5,
                          color: EColors.ink,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        '${searchState.results.length}${searchState.hasMore ? '+' : ''}건',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: appPalette.primary,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(height: 2, color: EColors.ink),
              ],
            ),
          );
        }

        // 하단 푸터: 더 불러오는 중 스피너 / 모두 로드됨 문구 (웹과 동일)
        if (index > searchState.results.length) {
          if (searchState.isFetchingMore) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    color: EColors.ink,
                    strokeWidth: 2,
                  ),
                ),
              ),
            );
          }
          if (!searchState.hasMore) {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Center(
                child: Text(
                  '${searchState.results.length}개 표시 (모두 로드됨)',
                  style: const TextStyle(fontSize: 13, color: EColors.mute),
                ),
              ),
            );
          }
          return const SizedBox.shrink();
        }

        final schedule = searchState.results[index - 1];
        void open() {
          if (schedule.albumFolder != null) {
            context.push('/album/${schedule.albumFolder}');
          } else {
            context.push('/schedule/${schedule.id}');
          }
        }

        if (schedule.isBirthday) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: EBirthdayCard(schedule: schedule, showYear: true),
          );
        }
        if (schedule.isDebut || schedule.isAnniversary) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: EDebutCard(schedule: schedule),
          );
        }
        return SearchRow(schedule: schedule, term: term, onTap: open);
      },
    );
  }
}
