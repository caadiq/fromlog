import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:ota_update/ota_update.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'update_config.dart';
import 'update_dialog.dart';
import 'update_info.dart';

/// Otto 인앱 OTA 자가 업데이트 서비스.
class UpdateService {
  /// 현재 빌드 versionCode로 latest 조회.
  /// 새 버전이면 [UpdateInfo], 최신이면 null.
  Future<UpdateInfo?> checkForUpdate() async {
    final pkg = await PackageInfo.fromPlatform();
    final current = int.tryParse(pkg.buildNumber) ?? 0;

    final uri = Uri.parse(
      '${UpdateConfig.baseUrl}/api/apps/${UpdateConfig.appId}/latest'
      '?versionCode=$current',
    );
    final res = await http.get(
      uri,
      headers: {'X-App-Key': UpdateConfig.appKey},
    );

    if (res.statusCode == 204) return null; // 이미 최신
    if (res.statusCode != 200) {
      throw Exception('업데이트 확인 실패 (${res.statusCode})');
    }
    final json = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
    return UpdateInfo.fromJson(json);
  }

  /// 앱 시작 시 호출: 조용히 확인 후 새 버전이면 다이얼로그 표시.
  /// 네트워크 등 실패는 무시(앱 사용엔 지장 없음).
  Future<void> check(BuildContext context) async {
    try {
      final info = await checkForUpdate();
      if (info == null || !context.mounted) return;
      await showUpdateDialog(context, info);
    } catch (_) {
      // 조용히 무시
    }
  }

  /// 다운로드 + 설치. 진행상황은 OtaEvent 스트림으로. sha256 무결성 검증 포함.
  ///
  /// usePackageInstaller: false → 시스템 패키지 인스톨러(인텐트) 사용.
  /// 설치 완료 후 "앱 설치됨 — 열기/완료" 시스템 화면이 떠서 바로 실행 가능.
  /// (true의 PackageInstaller 세션 방식은 설치 후 '열기' 프롬프트가 없음)
  Stream<OtaEvent> downloadAndInstall(UpdateInfo info) {
    return OtaUpdate().execute(
      info.downloadUrl,
      destinationFilename: '${UpdateConfig.appId}-${info.versionCode}.apk',
      sha256checksum: info.sha256,
      usePackageInstaller: false,
    );
  }
}
