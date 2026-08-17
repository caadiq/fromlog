/// 전체화면 재생.
///
/// 앱이 직접 만드는 화면이라 방향·상태바를 우리가 잡는다.
/// 가로 영상은 눕히고 세로 영상(쇼츠)은 세운다.
/// 나갈 때 보던 자리를 돌려주면 원래 화면이 이어서 튼다.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'youtube_player_controller.dart';

class YoutubeFullScreen extends StatefulWidget {
  final String videoId;
  final double aspectRatio;
  final Duration startAt;
  final bool autoPlay;

  const YoutubeFullScreen({
    super.key,
    required this.videoId,
    required this.aspectRatio,
    this.startAt = Duration.zero,
    this.autoPlay = false,
  });

  @override
  State<YoutubeFullScreen> createState() => _YoutubeFullScreenState();
}

class _YoutubeFullScreenState extends State<YoutubeFullScreen> {
  late final YoutubeController _controller;

  bool get _isPortraitVideo => widget.aspectRatio < 1;

  @override
  void initState() {
    super.initState();
    _controller = YoutubeController(
      videoId: widget.videoId,
      startAt: widget.startAt,
      autoPlay: widget.autoPlay,
    );
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
    // 회전이 끝난 뒤에 걸어야 한다 — 먼저 걸면 회전하면서 상태바가 되살아난다
    if (!mounted) return;
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    await Future<void>.delayed(const Duration(milliseconds: 400));
    if (!mounted) return;
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }

  Future<void> _leave() async {
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    await SystemChrome.setPreferredOrientations(DeviceOrientation.values);
  }

  @override
  void dispose() {
    _leave();
    _controller.dispose();
    super.dispose();
  }

  void _close() => Navigator.of(context).pop(_controller.position);

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _close();
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Stack(
          children: [
            Center(
              child: AspectRatio(
                aspectRatio: widget.aspectRatio,
                child: WebViewWidget(controller: _controller.webview),
              ),
            ),
            Positioned(
              top: 8,
              left: 8,
              child: SafeArea(
                child: GestureDetector(
                  onTap: _close,
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    padding: const EdgeInsets.all(9),
                    color: Colors.transparent,
                    child: const Icon(
                      LucideIcons.minimize,
                      size: 20,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
