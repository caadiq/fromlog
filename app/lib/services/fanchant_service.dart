/// 응원법 API 서비스
library;

import '../models/fanchant.dart';
import 'api_client.dart';

/// 곡 응원법 조회 — 시각을 아직 안 찍은 곡은 서버가 404를 준다
Future<Fanchant> getFanchant(int trackId) async {
  final response = await dio.get('/fanchant/$trackId');
  return Fanchant.fromJson(response.data);
}

/// 응원법이 있는 곡의 id 목록 (곡 상세에서 버튼을 띄울지 판단용)
Future<Set<int>> getFanchantTrackIds() async {
  final response = await dio.get('/fanchant');
  final items = response.data['items'] as List<dynamic>? ?? [];
  return items.map((e) => (e['trackId'] as num).toInt()).toSet();
}
