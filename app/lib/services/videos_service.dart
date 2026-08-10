/// 영상 아카이브 API 서비스 (웹 api/public/videos.js 대응)
library;

import '../models/video.dart';
import 'api_client.dart';

/// 영상 메인 화면 데이터 (피처드·섹션·쇼츠 레일)
Future<VideoHomeData> getVideosHome() async {
  final response = await dio.get('/videos/home');
  return VideoHomeData.fromJson(response.data);
}

/// 영상 전체보기 (필터·페이징)
/// [shorts] 'only' | 'exclude'
Future<VideoListPage> getVideos({
  String? category,
  String? channel,
  required String shorts,
  int limit = 24,
  int offset = 0,
}) async {
  final response = await dio.get('/videos', queryParameters: {
    if (category != null) 'category': category,
    if (channel != null && channel.isNotEmpty) 'channel': channel,
    'shorts': shorts,
    'limit': limit.toString(),
    'offset': offset.toString(),
  });
  return VideoListPage.fromJson(response.data);
}
