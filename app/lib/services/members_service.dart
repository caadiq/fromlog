/// 멤버 API 서비스
library;

import '../models/member.dart';
import 'api_client.dart';

/// 멤버 목록 조회
Future<List<Member>> getMembers() async {
  final response = await dio.get('/members');
  final List<dynamic> data = response.data;
  return data.map((json) => Member.fromJson(json)).toList();
}

/// 활동 중인 멤버만 조회
Future<List<Member>> getActiveMembers() async {
  final members = await getMembers();
  return members.where((m) => !m.isFormer).toList();
}

/// 멤버 최근 컨셉 포토 (상세 미리보기용)
Future<List<MemberPhoto>> getMemberPhotos(String nameEn, {int limit = 3}) async {
  final response = await dio.get(
    '/members/${Uri.encodeComponent(nameEn)}/photos',
    queryParameters: {'limit': '$limit'},
  );
  final List<dynamic> photos = response.data['photos'] ?? [];
  return photos.map((json) => MemberPhoto.fromJson(json)).toList();
}

/// 멤버 포함 전체 컨셉 포토 (갤러리용)
Future<List<MemberPhoto>> getMemberAllPhotos(String nameEn) async {
  final response = await dio.get(
    '/members/${Uri.encodeComponent(nameEn)}/photos',
    queryParameters: {'all': '1'},
  );
  final List<dynamic> photos = response.data['photos'] ?? [];
  return photos.map((json) => MemberPhoto.fromJson(json)).toList();
}
