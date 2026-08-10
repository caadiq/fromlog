/// 앨범 컨트롤러 (MVCS의 Controller 레이어)
///
/// 비즈니스 로직과 상태 관리를 담당합니다.
/// View는 이 Controller를 통해 데이터에 접근합니다.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/album.dart';
import '../services/albums_service.dart';

/// 앨범 상태
class AlbumState {
  final List<Album> albums;
  final bool isLoading;
  final String? error;

  const AlbumState({this.albums = const [], this.isLoading = true, this.error});

  /// 상태 복사 (불변성 유지)
  AlbumState copyWith({List<Album>? albums, bool? isLoading, String? error}) {
    return AlbumState(
      albums: albums ?? this.albums,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// 앨범 컨트롤러
class AlbumController extends Notifier<AlbumState> {
  @override
  AlbumState build() {
    // 초기 데이터 로드
    Future.microtask(() => loadAlbums());
    return const AlbumState();
  }

  /// 앨범 목록 로드
  Future<void> loadAlbums() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final albums = await getAlbums();
      state = state.copyWith(albums: albums, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  /// 앨범 새로고침
  Future<void> refresh() async {
    await loadAlbums();
  }
}

/// 앨범 Provider
final albumProvider = NotifierProvider<AlbumController, AlbumState>(
  AlbumController.new,
);
