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

  /// 전체화면 화면을 닫을 때 쓸 것 (웹뷰가 알려주면 우리가 닫는다)
  NavigatorState? _fsNavigator;

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
  /// 같은 웹뷰의 내용이 옮겨오는 것이라 재생이 끊기지 않는다.
  void _wireFullScreen(YoutubeController c) {
    final platform = c.webview.platform;
    if (platform is! AndroidWebViewController) return;
    platform.setCustomWidgetCallbacks(
      onShowCustomWidget: (content, _) {
        if (!mounted) return;
        final nav = Navigator.of(context, rootNavigator: true);
        _fsNavigator = nav;
        nav.push(
          PageRouteBuilder<void>(
            opaque: true,
            transitionDuration: Duration.zero,
            reverseTransitionDuration: Duration.zero,
            pageBuilder: (_, _, _) => YoutubeFullScreen(
              content: content,
              aspectRatio: widget.aspectRatio,
            ),
          ),
        );
      },
      onHideCustomWidget: () {
        _fsNavigator?.maybePop();
        _fsNavigator = null;
      },
    );
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

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: widget.aspectRatio,
      child: ColoredBox(
        color: Colors.black,
        child: WebViewWidget(controller: _controller.webview),
      ),
    );
  }
}
