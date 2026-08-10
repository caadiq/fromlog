/// 앨범 API 서비스
library;

import '../models/album.dart';
import 'api_client.dart';

/// 앨범 목록 조회
Future<List<Album>> getAlbums() async {
  final response = await dio.get('/albums');
  final List<dynamic> data = response.data;
  return data.map((json) => Album.fromJson(json)).toList();
}

/// 앨범 상세 조회 (폴더명으로)
Future<Album> getAlbumByName(String name) async {
  final response = await dio.get('/albums/by-name/$name');
  return Album.fromJson(response.data);
}

/// 트랙 상세 조회 (앨범명, 트랙명으로)
Future<TrackDetail> getTrack(String albumName, String trackTitle) async {
  final encodedAlbum = Uri.encodeComponent(albumName);
  final encodedTrack = Uri.encodeComponent(trackTitle);
  final response = await dio.get(
    '/albums/by-name/$encodedAlbum/track/$encodedTrack',
  );
  return TrackDetail.fromJson(response.data);
}
