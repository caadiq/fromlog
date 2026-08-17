/// 유튜브 영상 한 칸.
///
/// 컨트롤러를 만들고 치우는 일을 여기서만 한다 — 쓰는 쪽은 영상 id만 주면 된다.
/// 재생 위치가 필요한 화면(응원법)은 [onController]로 컨트롤러를 받아 간다.
library;

import 'package:flutter/material.dart';
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
    widget.onController?.call(c);
    return c;
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
    _controller.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return YoutubePlayer(controller: _controller, aspectRatio: widget.aspectRatio);
  }
}
