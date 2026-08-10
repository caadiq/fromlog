/// 홈 컨트롤러 (MVCS의 Controller 레이어)
///
/// 비즈니스 로직과 상태 관리를 담당합니다.
/// View는 이 Controller를 통해 데이터에 접근합니다.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/member.dart';
import '../models/album.dart';
import '../models/schedule.dart';
import '../services/members_service.dart';
import '../services/albums_service.dart';
import '../services/schedules_service.dart';

/// 홈 상태
class HomeState {
  final List<Member> members;
  final List<Album> albums;
  final List<Schedule> schedules;
  final bool isLoading;
  final bool dataLoaded;
  final String? error;

  const HomeState({
    this.members = const [],
    this.albums = const [],
    this.schedules = const [],
    this.isLoading = true,
    this.dataLoaded = false,
    this.error,
  });

  /// 상태 복사 (불변성 유지)
  HomeState copyWith({
    List<Member>? members,
    List<Album>? albums,
    List<Schedule>? schedules,
    bool? isLoading,
    bool? dataLoaded,
    String? error,
  }) {
    return HomeState(
      members: members ?? this.members,
      albums: albums ?? this.albums,
      schedules: schedules ?? this.schedules,
      isLoading: isLoading ?? this.isLoading,
      dataLoaded: dataLoaded ?? this.dataLoaded,
      error: error,
    );
  }
}

/// 홈 컨트롤러
class HomeController extends Notifier<HomeState> {
  @override
  HomeState build() {
    // 초기 데이터 로드
    Future.microtask(() => loadData());
    return const HomeState();
  }

  /// 데이터 로드 (멤버, 앨범, 일정)
  Future<void> loadData() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final results = await Future.wait([
        getActiveMembers(),
        getAlbums(), // 전체 목록 (통계 카운트 + 최신 3장 + D-day)
        getUpcomingSchedules(3),
      ]);

      state = state.copyWith(
        members: results[0] as List<Member>,
        albums: results[1] as List<Album>,
        schedules: results[2] as List<Schedule>,
        isLoading: false,
        dataLoaded: true,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        dataLoaded: true,
        error: e.toString(),
      );
    }
  }
}

/// 홈 Provider
final homeProvider = NotifierProvider<HomeController, HomeState>(
  HomeController.new,
);
