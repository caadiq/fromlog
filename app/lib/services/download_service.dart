/// 다운로드 서비스
library;

import 'dart:io';
import 'package:flutter_downloader/flutter_downloader.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';

/// 다운로드 서비스 초기화
Future<void> initDownloadService() async {
  await FlutterDownloader.initialize(debug: false, ignoreSsl: true);
}

/// URL에서 파일 확장자 추출
String _getExtensionFromUrl(String url) {
  try {
    final uri = Uri.parse(url);
    final path = uri.path.toLowerCase();

    // 동영상 확장자
    if (path.endsWith('.mp4')) return '.mp4';
    if (path.endsWith('.mov')) return '.mov';
    if (path.endsWith('.avi')) return '.avi';
    if (path.endsWith('.webm')) return '.webm';

    // 이미지 확장자
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return '.jpg';
    if (path.endsWith('.png')) return '.png';
    if (path.endsWith('.gif')) return '.gif';
    if (path.endsWith('.webp')) return '.webp';

    // 기본값
    return '.jpg';
  } catch (_) {
    return '.jpg';
  }
}

/// 파일 다운로드 (이미지/동영상)
Future<String?> downloadImage(String url, {String? fileName}) async {
  // 권한 요청
  if (Platform.isAndroid) {
    final status = await Permission.notification.request();
    if (status.isDenied) {
      // 알림 권한 거부해도 다운로드는 진행
    }
  }

  // 다운로드 경로 설정 (Pictures 폴더)
  final Directory directory;
  if (Platform.isAndroid) {
    directory = Directory('/storage/emulated/0/Pictures/fromis_9');
    if (!await directory.exists()) {
      await directory.create(recursive: true);
    }
  } else {
    directory = await getApplicationDocumentsDirectory();
  }

  // 파일명 생성 (URL에서 확장자 추출)
  final extension = _getExtensionFromUrl(url);
  final name =
      fileName ?? 'fromis9_${DateTime.now().millisecondsSinceEpoch}$extension';

  // 다운로드 시작
  final taskId = await FlutterDownloader.enqueue(
    url: url,
    savedDir: directory.path,
    fileName: name,
    showNotification: true,
    openFileFromNotification: true,
    saveInPublicStorage: true, // 갤러리에 표시
  );

  return taskId;
}
