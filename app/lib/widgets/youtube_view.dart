/// 유튜브 영상 한 칸.
///
/// 컨트롤러를 만들고 치우는 일을 여기서만 한다 — 쓰는 쪽은 영상 id만 주면 된다.
/// 재생 위치가 필요한 화면(응원법)은 [onController]로 컨트롤러를 받아 간다.
///
/// 비율도 여기서 잡는다. 쓰는 쪽에서 AspectRatio로 또 감싸면 안쪽 비율과
/// 어긋나 영상 아래에 배경이 띠처럼 남는다.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';

class YoutubeView extends StatefulWidget {
  final String videoId;
  final double aspectRatio;

  /// 컨트롤러가 만들어지면 한 번 알려준다 (재생 위치를 읽어야 하는 화면용)
  final void Function(YoutubePlayerController controller)? onController;

  /// 전체화면으로 드나들 때 알려준다.
  /// 스크롤 영역을 Overlay.wrap으로 감싸면 전체화면도 그 안에 갇히므로,
  /// 쓰는 쪽에서 머리말을 치워 본문이 화면을 다 쓰게 해야 한다.
  final void Function(bool isFullScreen)? onFullScreenChanged;

  const YoutubeView({
    super.key,
    required this.videoId,
    this.aspectRatio = 16 / 9,
    this.onController,
    this.onFullScreenChanged,
  });

  @override
  State<YoutubeView> createState() => _YoutubeViewState();
}

class _YoutubeViewState extends State<YoutubeView> {
  late YoutubePlayerController _controller;
  bool _fullScreen = false;
  StreamSubscription<YoutubePlayerValue>? _sub;

  /// 전체화면으로 드나들 때 돌아갈 자리.
  ///
  /// 화면을 돌리면 웹뷰가 다시 만들어져 영상이 처음부터 로드된다.
  /// 그 전에 어디까지 봤는지 적어두고, 다시 준비되면 그 자리로 돌려놓는다.
  double _resumeAt = 0;
  bool _resumePlaying = false;

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
    // 다시 로드되면(cued) 보던 자리로 돌려놓는다
    _sub?.cancel();
    _sub = c.listen(_onValue);
    widget.onController?.call(c);
    return c;
  }

  void _onValue(YoutubePlayerValue value) {
    if (_resumeAt <= 1) return;
    if (value.playerState != PlayerState.cued &&
        value.playerState != PlayerState.unStarted) {
      return;
    }
    final at = _resumeAt;
    final play = _resumePlaying;
    _resumeAt = 0;
    _controller.seekTo(seconds: at, allowSeekAhead: true);
    if (play) _controller.playVideo();
  }

  Future<void> _onFullScreen(bool isFullScreen) async {
    _fullScreen = isFullScreen;
    widget.onFullScreenChanged?.call(isFullScreen);
    // 돌리기 전에 어디까지 봤는지 적어둔다
    _resumePlaying = _controller.value.playerState == PlayerState.playing;
    _resumeAt = await _controller.currentTime;

    if (isFullScreen) {
      // 쇼츠 같은 세로 영상까지 눕히면 가운데 조그맣게 뜬다 — 비율대로 돌린다
      SystemChrome.setPreferredOrientations(
        widget.aspectRatio < 1
            ? const [DeviceOrientation.portraitUp]
            : const [
                DeviceOrientation.landscapeLeft,
                DeviceOrientation.landscapeRight,
              ],
      );
      await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
      // 회전이 끝난 뒤 한 번 더 걸어야 한다 — 먼저만 걸면 회전하면서
      // 상태바가 되살아난다 (가로 전체화면에서만 상태바가 보이던 이유)
      await Future<void>.delayed(const Duration(milliseconds: 450));
      if (_fullScreen) {
        await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
      }
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
    _sub?.cancel();
    _controller.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return YoutubePlayer(
      controller: _controller,
      aspectRatio: widget.aspectRatio,
      // 세로로 끌면 전체화면으로 들어가버려 화면을 못 내린다.
      // 전체화면은 버튼으로만 들어가게 둔다
      enableFullScreenOnVerticalDrag: false,
    );
  }
}
