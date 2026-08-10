/// 영상 메인 화면 컨트롤러
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/video.dart';
import '../services/videos_service.dart';

/// 영상 메인 상태
class VideosState {
  final VideoHomeData? data;
  final bool isLoading;
  final String? error;

  const VideosState({this.data, this.isLoading = true, this.error});

  VideosState copyWith({VideoHomeData? data, bool? isLoading, String? error}) {
    return VideosState(
      data: data ?? this.data,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class VideosController extends Notifier<VideosState> {
  @override
  VideosState build() {
    Future.microtask(load);
    return const VideosState();
  }

  Future<void> load() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final data = await getVideosHome();
      state = VideosState(data: data, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: '영상을 불러오지 못했습니다');
    }
  }
}

final videosProvider = NotifierProvider<VideosController, VideosState>(
  VideosController.new,
);
