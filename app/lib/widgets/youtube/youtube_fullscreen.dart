/// Keep the source WebView mounted while coordinating native fullscreen rotation.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'fullscreen_playback_recovery.dart';

class YoutubeFullScreen extends StatefulWidget {
  final Widget content;
  final double aspectRatio;
  final FullscreenPlaybackRecovery? playbackRecovery;
  final ValueListenable<bool> closing;
  final VoidCallback onReadyToClose;

  const YoutubeFullScreen({
    super.key,
    required this.content,
    required this.aspectRatio,
    required this.closing,
    required this.onReadyToClose,
    this.playbackRecovery,
  });

  @override
  State<YoutubeFullScreen> createState() => _YoutubeFullScreenState();
}

class _YoutubeFullScreenState extends State<YoutubeFullScreen>
    with WidgetsBindingObserver, SingleTickerProviderStateMixin {
  late final AnimationController _veil;
  Completer<void>? _portraitReady;
  Timer? _portraitTimeout;
  bool _leaving = false;
  bool _canPop = false;
  bool _restored = false;
  bool _reducedMotion = false;

  bool get _isPortraitVideo => widget.aspectRatio < 1;
  bool get _isPortrait {
    final size = View.of(context).physicalSize;
    return size.height >= size.width;
  }

  @override
  void initState() {
    super.initState();
    _veil = AnimationController(
      vsync: this,
      value: 1,
      duration: const Duration(milliseconds: 160),
    );
    WidgetsBinding.instance.addObserver(this);
    widget.closing.addListener(_onClosing);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (widget.closing.value) {
        _leave();
        return;
      }
      // Do not hold playback recovery behind a fixed rotation delay.
      widget.playbackRecovery?.start();
      _veil.reverse();
      _enter();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reducedMotion = MediaQuery.disableAnimationsOf(context);
    _veil.duration = _reducedMotion
        ? Duration.zero
        : const Duration(milliseconds: 160);
  }

  Future<void> _enter() async {
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    if (!mounted || _leaving) return;
    await SystemChrome.setPreferredOrientations(
      _isPortraitVideo
          ? const [DeviceOrientation.portraitUp]
          : const [
              DeviceOrientation.landscapeLeft,
              DeviceOrientation.landscapeRight,
            ],
    );
    if (!mounted || _leaving) return;
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }

  @override
  void didChangeMetrics() {
    if (!mounted) return;
    if (_leaving) {
      if (_isPortrait) _completePortraitWait();
    } else {
      // Rotation may restore system bars. Reapply after actual metrics change,
      // rather than delaying playback for an assumed rotation duration.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_leaving) {
          SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
        }
      });
    }
  }

  void _onClosing() {
    if (widget.closing.value) _leave();
  }

  void _completePortraitWait() {
    _portraitTimeout?.cancel();
    final ready = _portraitReady;
    if (ready != null && !ready.isCompleted) ready.complete();
  }

  Future<void> _waitForPortrait() async {
    if (_isPortrait) return;
    _portraitReady = Completer<void>();
    // Some devices ignore orientation requests. Never trap users in a black view.
    _portraitTimeout = Timer(
      const Duration(milliseconds: 1200),
      _completePortraitWait,
    );
    await _portraitReady!.future;
  }

  Future<void> _leave() async {
    if (_leaving || !mounted) return;
    setState(() => _leaving = true);
    widget.playbackRecovery?.cancel();
    try {
      // Keep the underlying landscape toolbar covered throughout rotation.
      await _veil.forward().orCancel;
      if (!mounted) return;
      await SystemChrome.setPreferredOrientations(const [
        DeviceOrientation.portraitUp,
      ]);
      if (!mounted) return;
      await _waitForPortrait();
      if (!mounted) return;
      await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
      if (!mounted) return;
      _restored = true;
      setState(() => _canPop = true);
      // Let the detail screen lay out at portrait size before revealing it.
      await WidgetsBinding.instance.endOfFrame;
      if (!mounted) return;
      widget.onReadyToClose();
    } on TickerCanceled {
      // The owning screen was removed during the transition.
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) widget.playbackRecovery?.cancel();
  }

  @override
  void dispose() {
    widget.playbackRecovery?.cancel();
    widget.closing.removeListener(_onClosing);
    WidgetsBinding.instance.removeObserver(this);
    _completePortraitWait();
    _veil.dispose();
    if (!_restored) {
      // Fallback for route replacement / owner disposal outside normal exit.
      SystemChrome.setPreferredOrientations(const [
        DeviceOrientation.portraitUp,
      ]);
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope<void>(
      canPop: _canPop,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _leave();
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: AbsorbPointer(
          absorbing: _leaving,
          child: Listener(
            behavior: HitTestBehavior.translucent,
            onPointerDown: (_) => widget.playbackRecovery?.cancel(),
            child: Stack(
              fit: StackFit.expand,
              children: [
                widget.content,
                IgnorePointer(
                  child: FadeTransition(
                    opacity: _veil.drive(CurveTween(curve: Curves.easeInOut)),
                    child: const ColoredBox(color: Colors.black),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Own the exact fullscreen route so a delayed WebView callback cannot pop detail.
class YoutubeFullscreenSession {
  PageRoute<void>? _route;
  bool _hiddenByWebView = false;
  FullscreenPlaybackRecovery? _playbackRecovery;
  ValueNotifier<bool>? _closing;

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
    final closing = ValueNotifier(false);
    _closing = closing;
    late final PageRoute<void> route;
    var nativeNotified = false;
    void notifyNative() {
      if (_hiddenByWebView || nativeNotified) return;
      nativeNotified = true;
      onFlutterExit();
    }

    route = PageRouteBuilder<void>(
      // Keep the source platform view onstage; the black surface covers detail.
      opaque: false,
      maintainState: true,
      allowSnapshotting: false,
      transitionDuration: Duration.zero,
      reverseTransitionDuration:
          MediaQuery.disableAnimationsOf(navigator.context)
          ? Duration.zero
          : const Duration(milliseconds: 160),
      transitionsBuilder: (_, animation, _, child) => FadeTransition(
        opacity: animation.drive(CurveTween(curve: Curves.easeInOut)),
        child: child,
      ),
      pageBuilder: (_, _, _) => YoutubeFullScreen(
        content: content,
        aspectRatio: aspectRatio,
        playbackRecovery: playbackRecovery,
        closing: closing,
        onReadyToClose: () {
          if (!identical(_route, route) || !route.isActive) return;
          notifyNative();
          if (route.isCurrent) {
            navigator.pop();
          } else {
            navigator.removeRoute(route);
          }
        },
      ),
    );
    _route = route;
    await navigator.push(route);
    playbackRecovery?.cancel();
    // Keep the session occupied until the exit animation and platform view end.
    await route.completed;
    closing.dispose();
    if (!identical(_route, route)) return;
    _route = null;
    _closing = null;
    _playbackRecovery = null;
    notifyNative();
  }

  void hide() {
    _playbackRecovery?.cancel();
    if (_route == null) return;
    _hiddenByWebView = true;
    _closing?.value = true;
  }
}
