/// 전체화면 재생.
///
/// Preserve the source WebView and restore playback after native view attachment.
///
/// 앱 화면이라 방향·상태바는 우리가 잡는다.
/// 가로 영상은 눕히고 세로 영상(쇼츠)은 세운다.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'fullscreen_playback_recovery.dart';

class YoutubeFullScreen extends StatefulWidget {
  /// 웹뷰가 넘겨준 전체화면 내용
  final Widget content;

  /// 영상 비율 — 눕힐지 세울지 정한다
  final double aspectRatio;
  final FullscreenPlaybackRecovery? playbackRecovery;

  const YoutubeFullScreen({
    super.key,
    required this.content,
    required this.aspectRatio,
    this.playbackRecovery,
  });

  @override
  State<YoutubeFullScreen> createState() => _YoutubeFullScreenState();
}

class _YoutubeFullScreenState extends State<YoutubeFullScreen>
    with WidgetsBindingObserver {
  bool get _isPortraitVideo => widget.aspectRatio < 1;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _enter();
  }

  Future<void> _enter() async {
    await SystemChrome.setPreferredOrientations(
      _isPortraitVideo
          ? const [DeviceOrientation.portraitUp]
          : const [
              DeviceOrientation.landscapeLeft,
              DeviceOrientation.landscapeRight,
            ],
    );
    if (!mounted) return;
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    // 회전이 끝난 뒤 한 번 더 걸어야 한다 — 먼저만 걸면 회전하면서 상태바가 되살아난다
    await Future<void>.delayed(const Duration(milliseconds: 450));
    if (!mounted) return;
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    if (!mounted) return;
    widget.playbackRecovery?.start();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) widget.playbackRecovery?.cancel();
  }

  @override
  void dispose() {
    widget.playbackRecovery?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setPreferredOrientations(const [DeviceOrientation.portraitUp]);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // 나가기는 유튜브 자체 버튼(또는 뒤로가기)이 처리한다 —
    // 웹뷰가 onHideCustomWidget으로 알려주면 이 화면이 닫힌다
    return Scaffold(
      backgroundColor: Colors.black,
      body: Listener(
        behavior: HitTestBehavior.translucent,
        onPointerDown: (_) => widget.playbackRecovery?.cancel(),
        child: SizedBox.expand(child: widget.content),
      ),
    );
  }
}

/// Own the exact fullscreen route so a delayed WebView callback cannot pop detail.
class YoutubeFullscreenSession {
  Route<void>? _route;
  bool _hiddenByWebView = false;
  FullscreenPlaybackRecovery? _playbackRecovery;

  bool get isOpen => _route != null;

  Future<void> show({
    required NavigatorState navigator,
    required Widget content,
    required double aspectRatio,
    required VoidCallback onFlutterExit,
    FullscreenPlaybackRecovery? playbackRecovery,
  }) async {
    if (_route != null) {
      playbackRecovery?.cancel();
      return;
    }
    _playbackRecovery = playbackRecovery;
    _hiddenByWebView = false;
    final route = PageRouteBuilder<void>(
      // Keep the source platform view visible to Android while its custom view
      // covers it. Offstaging the WebView can pause HTML media on fullscreen entry.
      // The black fullscreen Scaffold still covers and blocks the detail screen.
      opaque: false,
      maintainState: true,
      allowSnapshotting: false,
      transitionDuration: Duration.zero,
      reverseTransitionDuration: Duration.zero,
      pageBuilder: (_, _, _) => YoutubeFullScreen(
        content: content,
        aspectRatio: aspectRatio,
        playbackRecovery: playbackRecovery,
      ),
    );
    _route = route;
    await navigator.push(route);
    playbackRecovery?.cancel();
    if (!identical(_route, route)) return;
    _route = null;
    _playbackRecovery = null;
    if (!_hiddenByWebView) onFlutterExit();
  }

  void hide() {
    _playbackRecovery?.cancel();
    final route = _route;
    if (route == null) return;
    _hiddenByWebView = true;
    if (route.isActive) route.navigator?.removeRoute(route);
  }
}
