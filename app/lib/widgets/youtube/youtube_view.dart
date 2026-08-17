/// 유튜브 영상 한 칸.
///
/// 웹뷰가 그냥 위젯이라 스크롤 영역에서 제대로 잘리고, 전체화면은 앱이 만든다.
/// 쓰는 쪽은 영상 id만 주면 되고, 재생 위치가 필요한 화면(응원법)은
/// [onController]로 컨트롤러를 받아 간다.
library;

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'youtube_fullscreen.dart';
import 'youtube_player_controller.dart';

class YoutubeView extends StatefulWidget {
  final String videoId;
  final double aspectRatio;
  final void Function(YoutubeController controller)? onController;

  const YoutubeView({
    super.key,
    required this.videoId,
    this.aspectRatio = 16 / 9,
    this.onController,
  });

  @override
  State<YoutubeView> createState() => _YoutubeViewState();
}

class _YoutubeViewState extends State<YoutubeView> {
  late YoutubeController _controller;

  @override
  void initState() {
    super.initState();
    _controller = _create();
  }

  YoutubeController _create() {
    final c = YoutubeController(videoId: widget.videoId);
    widget.onController?.call(c);
    return c;
  }

  @override
  void didUpdateWidget(YoutubeView old) {
    super.didUpdateWidget(old);
    if (old.videoId != widget.videoId) {
      _controller.dispose();
      _controller = _create();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// 전체화면으로 넘어갔다가 보던 자리를 받아 돌아온다
  Future<void> _openFullScreen() async {
    final wasPlaying = _controller.isPlaying;
    await _controller.pause();
    if (!mounted) return;

    final back = await Navigator.of(context, rootNavigator: true).push<Duration>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => YoutubeFullScreen(
          videoId: widget.videoId,
          aspectRatio: widget.aspectRatio,
          startAt: _controller.position,
          autoPlay: wasPlaying,
        ),
      ),
    );
    if (!mounted || back == null) return;
    await _controller.seekTo(back);
  }

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: widget.aspectRatio,
      child: ColoredBox(
        color: Colors.black,
        child: Stack(
          children: [
            Positioned.fill(child: WebViewWidget(controller: _controller.webview)),
            // 유튜브 자체 전체화면(fs=0)은 껐다 — 앱이 만든 버튼으로 들어간다
            Positioned(
              right: 6,
              bottom: 6,
              child: GestureDetector(
                onTap: _openFullScreen,
                behavior: HitTestBehavior.opaque,
                child: Container(
                  padding: const EdgeInsets.all(7),
                  color: Colors.transparent,
                  child: const Icon(
                    LucideIcons.maximize,
                    size: 17,
                    color: Colors.white,
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
