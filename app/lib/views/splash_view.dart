import 'package:flutter/material.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:go_router/go_router.dart';

import '../core/constants.dart';
import '../update/update_dialog.dart';
import '../update/update_info.dart';
import '../update/update_service.dart';

/// 첫 진입 게이트: **네이티브 스플래시를 유지한 채** Otto 업데이트를 확인한다.
/// (자체 스플래시 화면을 그리지 않아 스플래시가 두 번 보이지 않음)
/// 새 버전이 있으면 네이티브 스플래시 제거 후 다이얼로그를 띄우고(강제면 진입 차단),
/// 없으면 바로 홈으로 이동.
class SplashGate extends StatefulWidget {
  const SplashGate({super.key});

  @override
  State<SplashGate> createState() => _SplashGateState();
}

class _SplashGateState extends State<SplashGate> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _boot());
  }

  Future<void> _boot() async {
    UpdateInfo? info;
    try {
      info = await UpdateService().checkForUpdate();
    } catch (_) {
      // 네트워크 등 실패는 무시하고 진입
    }
    if (!mounted) return;

    // 업데이트 확인이 끝났으니 네이티브 스플래시 종료
    FlutterNativeSplash.remove();

    if (info != null) {
      // 강제 업데이트면 닫을 수 없어 여기서 멈춤(설치 후 앱 종료)
      await showUpdateDialog(context, info);
    }
    if (!mounted) return;
    context.go('/');
  }

  @override
  Widget build(BuildContext context) {
    // 네이티브 스플래시가 이 위를 덮고 있으므로 배경색만 맞춰둔다
    return const Scaffold(
      backgroundColor: EColors.paper,
      body: SizedBox.shrink(),
    );
  }
}
