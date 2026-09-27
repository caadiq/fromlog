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
  final Map<String, String> sectionErrors;

  const HomeState({
    this.members = const [],
    this.albums = const [],
    this.schedules = const [],
    this.isLoading = true,
    this.dataLoaded = false,
    this.error,
    this.sectionErrors = const {},
  });

  /// 상태 복사 (불변성 유지)
  HomeState copyWith({
    List<Member>? members,
    List<Album>? albums,
    List<Schedule>? schedules,
    bool? isLoading,
    bool? dataLoaded,
    String? error,
    Map<String, String>? sectionErrors,
  }) {
    return HomeState(
      members: members ?? this.members,
      albums: albums ?? this.albums,
      schedules: schedules ?? this.schedules,
      isLoading: isLoading ?? this.isLoading,
      dataLoaded: dataLoaded ?? this.dataLoaded,
      error: error,
      sectionErrors: sectionErrors ?? this.sectionErrors,
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
  int _generation = 0;

  Future<void> loadData({String? section}) async {
    final generation = ++_generation;
    state = state.copyWith(isLoading: true, error: null);
    final errors = {...state.sectionErrors};
    var members = state.members;
    var albums = state.albums;
    var schedules = state.schedules;
    Future<void> fetch(String key, Future<void> Function() action) async {
      if (section != null && section != key) return;
      try {
        await action();
        errors.remove(key);
      } catch (_) {
        errors[key] = '불러오지 못했습니다.';
      }
    }

    await Future.wait([
      fetch('members', () async {
        members = await getActiveMembers();
      }),
      fetch('albums', () async {
        albums = await getAlbums();
      }),
      fetch('schedules', () async {
        schedules = await getUpcomingSchedules(3);
      }),
    ]);
    if (!ref.mounted || generation != _generation) return;
    state = state.copyWith(
      members: members,
      albums: albums,
      schedules: schedules,
      sectionErrors: errors,
      isLoading: false,
      dataLoaded: true,
    );
  }
}

/// 홈 Provider
final homeProvider = NotifierProvider<HomeController, HomeState>(
  HomeController.new,
);
