/// FCM 푸시 알림 서비스
///
/// 앱 시작 시 초기화 → 알림 권한 요청 → 토큰을 백엔드에 등록.
/// 현재는 운영 알림(X 세션 만료 등) 수신용이며, 추후 컴백·일정 알림으로 확장.
library;

import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../core/constants.dart';
import '../core/secrets.dart';

/// 운영 알림 수신 기기로 등록하기 위한 키 (백엔드 PUSH_ADMIN_KEY와 일치)
/// 실제 값은 git에 올리지 않는 core/secrets.dart에 둔다.
const String _pushAdminKey = Secrets.pushAdminKey;

/// 백그라운드 메시지 핸들러 (top-level이어야 함)
@pragma('vm:entry-point')
Future<void> _onBackgroundMessage(RemoteMessage message) async {
  // 알림 페이로드는 시스템이 표시하므로 별도 처리 없음
}

/// 백엔드에 토큰 등록
Future<void> _registerToken(String token) async {
  try {
    await http
        .post(
          Uri.parse('$apiBaseUrl/push/register'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'token': token,
            'platform': 'android',
            'adminKey': _pushAdminKey,
          }),
        )
        .timeout(const Duration(seconds: 10));
  } catch (e) {
    debugPrint('[push] 토큰 등록 실패: $e');
  }
}

/// 푸시 초기화 — main()에서 호출 (실패해도 앱 구동엔 지장 없음)
Future<void> initPush() async {
  try {
    await Firebase.initializeApp();

    final messaging = FirebaseMessaging.instance;

    // Android 13+ 알림 권한
    await messaging.requestPermission(alert: true, badge: true, sound: true);

    FirebaseMessaging.onBackgroundMessage(_onBackgroundMessage);

    final token = await messaging.getToken();
    if (token != null) {
      await _registerToken(token);
      debugPrint('[push] 토큰 등록 완료');
    }

    // 토큰 갱신 시 재등록
    messaging.onTokenRefresh.listen(_registerToken);
  } catch (e) {
    debugPrint('[push] 초기화 실패: $e');
  }
}
