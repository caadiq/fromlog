/// 유튜브 영상 한 칸.
///
/// 웹뷰가 그냥 위젯이라 스크롤 영역에서 제대로 잘린다.
/// 전체화면은 유튜브 기본 버튼을 그대로 쓰고, 웹뷰가 넘겨주는 화면을 앱이 띄운다.
/// 쓰는 쪽은 영상 id만 주면 되고, 재생 위치가 필요한 화면(응원법)은
/// [onController]로 컨트롤러를 받아 간다.
library;

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import 'fullscreen_playback_recovery.dart';
import 'youtube_fullscreen.dart';
import 'youtube_player_controller.dart';
import '../content_image.dart';

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

  /// 전체화면 화면을 닫을 때 쓸 것 (웹뷰가 알려주면 우리가 닫는다)
  final _fullscreen = YoutubeFullscreenSession();
  FullscreenPlaybackRecovery? _playbackRecovery;

  @override
  void initState() {
    super.initState();
    _controller = _create();
  }

  YoutubeController _create() {
    final c = YoutubeController(videoId: widget.videoId);
    _wireFullScreen(c);
    widget.onController?.call(c);
    return c;
  }

  /// 유튜브가 전체화면을 요청하면 웹뷰가 그 화면을 통째로 넘겨준다.
  /// Preserve the WebView and recover playback after native view attachment.
  void _wireFullScreen(YoutubeController c) {
    final platform = c.webview.platform;
    if (platform is! AndroidWebViewController) return;
    platform.setCustomWidgetCallbacks(
      onShowCustomWidget: (content, onCustomWidgetHidden) {
        if (!mounted || !identical(c, _controller)) {
          onCustomWidgetHidden();
          return;
        }
        if (_fullscreen.isOpen) return;
        _playbackRecovery?.cancel();
        final positionBeforeFullscreen = c.position;
        final recovery = FullscreenPlaybackRecovery(
          wasPlaying: c.isPlaying,
          readState: c.readPlaybackState,
          resumeIfPaused: c.resumeFullscreenPlaybackIfPaused,
          repairPositionIfReset: () =>
              c.repairFullscreenPositionIfReset(positionBeforeFullscreen),
        );
        _playbackRecovery = recovery;
        debugPrint('[yt-fullscreen] enter: ${c.state.name}');
        _fullscreen.show(
          navigator: Navigator.of(context, rootNavigator: true),
          content: content,
          aspectRatio: widget.aspectRatio,
          onFlutterExit: onCustomWidgetHidden,
          playbackRecovery: recovery,
        );
      },
      onHideCustomWidget: _fullscreen.hide,
    );
  }

  @override
  void didUpdateWidget(YoutubeView old) {
    super.didUpdateWidget(old);
    if (old.videoId != widget.videoId) {
      _playbackRecovery?.cancel();
      _controller.dispose();
      _controller = _create();
    }
  }

  void _retry() {
    if (_fullscreen.isOpen) return;
    _playbackRecovery?.cancel();
    _controller.dispose();
    setState(() {
      _controller = _create();
    });
  }

  @override
  void dispose() {
    _playbackRecovery?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: widget.aspectRatio,
      child: ColoredBox(
        color: Colors.black,
        child: Stack(
          children: [
            Positioned.fill(
              child: WebViewWidget(controller: _controller.webview),
            ),
            // 막혔을 때 유튜브 화면의 코드(152-4)는 안내용이라 원인을 못 좁힌다.
            // IFrame API가 주는 실제 onError 코드를 같이 띄운다 (2·5·101·150·153…)
            ListenableBuilder(
              listenable: _controller,
              builder: (_, _) {
                final code = _controller.errorCode;
                if (code == null) return const SizedBox.shrink();
                return Positioned.fill(
                  child: ColoredBox(
                    color: Colors.black87,
                    child: MediaRetry(
                      message: '영상을 불러오지 못했습니다.\n오류 $code',
                      onRetry: _retry,
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
