/// 전체화면 재생.
///
/// 유튜브 기본 전체화면 버튼을 그대로 쓴다. 웹뷰가 그때 넘겨주는 화면(customWidget)을
/// 여기서 띄우기만 한다 — 같은 웹뷰의 내용이 옮겨오는 것이라 재생이 끊기지 않는다.
///
/// 앱 화면이라 방향·상태바는 우리가 잡는다.
/// 가로 영상은 눕히고 세로 영상(쇼츠)은 세운다.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class YoutubeFullScreen extends StatefulWidget {
  /// 웹뷰가 넘겨준 전체화면 내용
  final Widget content;

  /// 영상 비율 — 눕힐지 세울지 정한다
  final double aspectRatio;

  const YoutubeFullScreen({
    super.key,
    required this.content,
    required this.aspectRatio,
  });

  @override
  State<YoutubeFullScreen> createState() => _YoutubeFullScreenState();
}

class _YoutubeFullScreenState extends State<YoutubeFullScreen> {
  bool get _isPortraitVideo => widget.aspectRatio < 1;

  @override
  void initState() {
    super.initState();
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
  }

  @override
  void dispose() {
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setPreferredOrientations(DeviceOrientation.values);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // 나가기는 유튜브 자체 버튼(또는 뒤로가기)이 처리한다 —
    // 웹뷰가 onHideCustomWidget으로 알려주면 이 화면이 닫힌다
    return Scaffold(
      backgroundColor: Colors.black,
      body: SizedBox.expand(child: widget.content),
    );
  }
}
