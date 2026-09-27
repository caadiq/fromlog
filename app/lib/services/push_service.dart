/// FCM 푸시 알림 서비스
///
/// 앱 시작 시 초기화 → 알림 권한 요청 → 토큰을 백엔드에 등록.
/// 현재는 운영 알림(X 세션 만료 등) 수신용이며, 추후 컴백·일정 알림으로 확장.
library;

import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'push_navigation.dart';
import 'package:http/http.dart' as http;

import '../core/constants.dart';
import '../core/secrets.dart';

/// 운영 알림 수신 기기로 등록하기 위한 키 (백엔드 PUSH_ADMIN_KEY와 일치)
/// 실제 값은 git에 올리지 않는 core/secrets.dart에 둔다.
const String _pushAdminKey = Secrets.pushAdminKey;
final pushMessengerKey = GlobalKey<ScaffoldMessengerState>();
final pushNavigation = PushNavigation(
  open: (uri) => launchUrl(uri, mode: LaunchMode.externalApplication),
);

void _openNotification(RemoteMessage message) {
  pushNavigation.receive(message.data, messageId: message.messageId);
}

/// 백그라운드 메시지 핸들러 (top-level이어야 함)
@pragma('vm:entry-point')
Future<void> _onBackgroundMessage(RemoteMessage message) async {
  // 알림 페이로드는 시스템이 표시하므로 별도 처리 없음
}

/// 백엔드에 토큰 등록
Future<void> _registerToken(String token) async {
  final client = http.Client();
  try {
    final response = await client
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
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError('HTTP ${response.statusCode}');
    }
    debugPrint('[push] 토큰 등록 완료');
  } catch (e) {
    debugPrint('[push] 토큰 등록 실패: $e');
  } finally {
    client.close();
  }
}

/// 푸시 초기화 — main()에서 호출 (실패해도 앱 구동엔 지장 없음)
Future<void> initPush() async {
  try {
    await Firebase.initializeApp().timeout(const Duration(seconds: 5));

    final messaging = FirebaseMessaging.instance;

    FirebaseMessaging.onBackgroundMessage(_onBackgroundMessage);
    FirebaseMessaging.onMessageOpenedApp.listen(_openNotification);
    FirebaseMessaging.onMessage.listen((message) {
      final notification = message.notification;
      if (notification == null) return;
      pushMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(
            [
              notification.title,
              notification.body,
            ].whereType<String>().join('\n'),
          ),
          action: pushDestination(message.data) == null
              ? null
              : SnackBarAction(
                  label: '확인',
                  onPressed: () => _openNotification(message),
                ),
        ),
      );
    });
    messaging.onTokenRefresh.listen(_registerToken);
    try {
      final initial = await messaging.getInitialMessage().timeout(
        const Duration(seconds: 5),
      );
      if (initial != null) _openNotification(initial);
    } catch (error) {
      debugPrint('[push] 시작 알림 확인 실패: $error');
    }

    // Android 13+ 알림 권한
    await messaging.requestPermission(alert: true, badge: true, sound: true);

    final token = await messaging.getToken().timeout(
      const Duration(seconds: 10),
    );
    if (token != null) {
      await _registerToken(token);
    }
  } catch (e) {
    debugPrint('[push] 초기화 실패: $e');
  }
}
