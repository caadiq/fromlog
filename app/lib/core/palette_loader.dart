/// 동적 테마 팔레트 로더 — 앱 시작 시 `/api/theme`에서 색을 받아 [appPalette] 갱신
library;

import 'package:dio/dio.dart';

import 'constants.dart';
import 'format_utils.dart';
import '../services/api_client.dart';


/// `/api/theme` 조회 후 [appPalette] 교체. 실패 시 기본 브랜드 그린 유지.
Future<void> loadPalette() async {
  try {
    // 오프라인 시 앱 시작이 지연되지 않도록 짧은 타임아웃
    final res = await dio.get(
      '/theme',
      options: Options(
        receiveTimeout: const Duration(seconds: 3),
        sendTimeout: const Duration(seconds: 3),
      ),
    );
    final data = res.data as Map<String, dynamic>;
    appPalette = Palette(
      primary: parseHexColorOrNull(data['primary'] as String)!,
      soft: parseHexColorOrNull(data['soft'] as String)!,
      deep: parseHexColorOrNull(data['deep'] as String)!,
    );
  } catch (_) {
    // 네트워크 실패 시 기본 팔레트 유지
  }
}
