/// 유튜브 영상 한 칸.
///
/// 컨트롤러를 만들고 치우는 일을 여기서만 한다 — 쓰는 쪽은 영상 id만 주면 된다.
/// 재생 위치가 필요한 화면(응원법)은 [onController]로 컨트롤러를 받아 간다.
///
/// 비율도 여기서 잡는다. 쓰는 쪽에서 AspectRatio로 또 감싸면 안쪽 비율과
/// 어긋나 영상 아래에 배경이 띠처럼 남는다.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';

class YoutubeView extends StatefulWidget {
  final String videoId;
  final double aspectRatio;

  /// 컨트롤러가 만들어지면 한 번 알려준다 (재생 위치를 읽어야 하는 화면용)
  final void Function(YoutubePlayerController controller)? onController;

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
  late YoutubePlayerController _controller;
  bool _fullScreen = false;

  @override
  void initState() {
    super.initState();
    _controller = _create();
  }

  YoutubePlayerController _create() {
    final c = YoutubePlayerController.fromVideoId(
      videoId: widget.videoId,
      autoPlay: false,
      params: const YoutubePlayerParams(
        showFullscreenButton: true,
        strictRelatedVideos: true,
      ),
    );
    // 이 패키지는 전체화면을 오버레이로만 처리해서 세로 그대로 남는다.
    // 영상은 가로가 자연스러우니 방향을 직접 돌린다.
    c.setFullScreenListener(_onFullScreen);
    widget.onController?.call(c);
    return c;
  }

  void _onFullScreen(bool isFullScreen) {
    _fullScreen = isFullScreen;
    if (isFullScreen) {
      SystemChrome.setPreferredOrientations(const [
        DeviceOrientation.landscapeLeft,
        DeviceOrientation.landscapeRight,
      ]);
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    } else {
      _restore();
    }
  }

  /// 세로로 되돌리고 상태바를 다시 보여준다
  void _restore() {
    SystemChrome.setPreferredOrientations(DeviceOrientation.values);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  }

  @override
  void didUpdateWidget(YoutubeView old) {
    super.didUpdateWidget(old);
    // 다른 영상으로 바뀌면 갈아끼운다
    if (old.videoId != widget.videoId) {
      _controller.close();
      _controller = _create();
    }
  }

  @override
  void dispose() {
    // 전체화면인 채로 화면을 벗어나면 가로로 눕은 채 남는다
    if (_fullScreen) _restore();
    _controller.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return YoutubePlayer(
      controller: _controller,
      aspectRatio: widget.aspectRatio,
    );
  }
}
