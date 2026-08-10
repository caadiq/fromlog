/// fromis_9 Unofficial App
///
/// MVCS 아키텍처:
/// - Models: 데이터 모델
/// - Views: UI 화면
/// - Controllers: 비즈니스 로직 (Riverpod)
/// - Services: API 통신
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:visibility_detector/visibility_detector.dart';
import 'package:kakao_map_sdk/kakao_map_sdk.dart';
import 'core/router.dart';
import 'core/constants.dart';
import 'core/secrets.dart';
import 'core/palette_loader.dart';
import 'services/download_service.dart';
import 'services/push_service.dart';

void main() async {
  final widgetsBinding = WidgetsFlutterBinding.ensureInitialized();

  // 네이티브 스플래시를 업데이트 확인(SplashGate)이 끝날 때까지 유지
  FlutterNativeSplash.preserve(widgetsBinding: widgetsBinding);

  // 카카오맵 SDK 초기화 (네이티브 앱 키) — 실패해도 앱 구동엔 지장 없음
  try {
    await KakaoMapSdk.instance.initialize(Secrets.kakaoNativeAppKey);
  } catch (_) {}

  // 다운로드 서비스 초기화
  await initDownloadService();

  // 푸시 알림 초기화 (FCM) — 실패해도 앱 구동엔 지장 없음
  await initPush();

  // 동적 테마 팔레트 로드 (/api/theme) — 실패 시 기본 브랜드 그린 유지
  await loadPalette();

  // 스크롤 리빌(EReveal) 반응 속도 — 기본 500ms는 너무 늦음
  VisibilityDetectorController.instance.updateInterval = const Duration(milliseconds: 80);

  // 상태바 및 네비게이션 바 스타일 설정
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      // 상태바
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      // 네비게이션 바 (소프트키) — 에디토리얼 paper
      systemNavigationBarColor: Color(0xFFFBFBF9),
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );

  runApp(const ProviderScope(child: Fromis9App()));
}

class Fromis9App extends StatelessWidget {
  const Fromis9App({super.key});

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        systemNavigationBarColor: Color(0xFFFBFBF9),
        systemNavigationBarIconBrightness: Brightness.dark,
        systemNavigationBarDividerColor: Colors.transparent,
      ),
      child: MaterialApp.router(
        title: 'fromis_9',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          // surface를 paper로 고정 — M3 surface tint로 배경이 미묘하게 달라지는 것 방지
          colorScheme: ColorScheme.fromSeed(
            seedColor: appPalette.primary,
            brightness: Brightness.light,
            surface: EColors.paper,
          ),
          scaffoldBackgroundColor: EColors.paper,
          canvasColor: EColors.paper,
          applyElevationOverlayColor: false,
          appBarTheme:  AppBarTheme(
            backgroundColor: EColors.paper,
            surfaceTintColor: Colors.transparent,
            foregroundColor: EColors.ink,
            elevation: 0,
            scrolledUnderElevation: 0,
            centerTitle: true,
            titleTextStyle: TextStyle(
              fontFamily: 'Pretendard',
              color: appPalette.primary,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          fontFamily: 'Pretendard',
        ),
        routerConfig: appRouter,
      ),
    );
  }
}
