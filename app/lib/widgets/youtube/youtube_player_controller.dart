/// 유튜브 IFrame Player를 웹뷰에 직접 띄우고 다루는 컨트롤러.
///
/// 패키지를 쓰다가 직접 만든 이유 — 그 패키지는 웹뷰를 오버레이에 얹고
/// 전체화면도 자기가 처리해서, 스크롤 clip·화면 방향·상태바가 전부 어긋났다.
/// 여기서는 웹뷰가 그냥 위젯이라 잘릴 데서 잘리고, 전체화면도 우리가 만든다.
///
/// 웹(프론트)에서 쓰는 것과 같은 IFrame Player API다.
library;

import 'dart:async';
import 'dart:convert';

import 'dart:ui' show Color;

import 'package:flutter/foundation.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// 재생 상태 (유튜브 IFrame API 값 그대로)
enum YtState { unstarted, ended, playing, paused, buffering, cued }

YtState _stateOf(int code) => switch (code) {
  0 => YtState.ended,
  1 => YtState.playing,
  2 => YtState.paused,
  3 => YtState.buffering,
  5 => YtState.cued,
  _ => YtState.unstarted,
};

class YoutubeController extends ChangeNotifier {
  YoutubeController({
    required this.videoId,
    this.startAt = Duration.zero,
    this.autoPlay = false,
  }) {
    _lastPos = startAt;
    _init();
  }

  final String videoId;

  /// 임베드를 띄운 곳으로 유튜브에 알릴 주소.
  ///
  /// 웹뷰에 심은 문서는 주소가 없어 Referer가 비고, 그러면 유튜브가
  /// "이 동영상은 볼 수 없습니다"로 막는다. 앱 아이디를 주소 꼴로 만들어
  /// baseUrl과 playerVars.origin에 같이 준다 (유튜브가 안내하는 방식).
  static const _origin = 'https://com.caadiq.fromlog';

  /// 처음 열 때 여기부터 (전체화면으로 옮겨갈 때 보던 자리를 넘겨받는다)
  final Duration startAt;
  final bool autoPlay;
  late final WebViewController webview;

  bool _ready = false;

  /// 유튜브가 준 오류 코드 (막혔을 때 무엇 때문인지 알려면 필요하다)
  int? errorCode;
  YtState _state = YtState.unstarted;
  Duration _duration = Duration.zero;

  /// 마지막으로 받은 위치와 그때부터 흐른 시간.
  /// 신호는 100ms마다 오므로 그 사이는 흐른 시간으로 메운다 — 안 그러면 한 박자 늦다.
  Duration _lastPos = Duration.zero;
  final Stopwatch _since = Stopwatch();

  bool get isReady => _ready;
  YtState get state => _state;
  bool get isPlaying => _state == YtState.playing;
  Duration get duration => _duration;

  /// 지금 재생 위치 (재생 중이면 흐른 만큼 더해서 돌려준다)
  Duration get position {
    if (!isPlaying) return _lastPos;
    return _lastPos + _since.elapsed;
  }

  void _init() {
    webview = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF000000))
      ..addJavaScriptChannel('Bridge', onMessageReceived: _onMessage)
      ..loadHtmlString(_html, baseUrl: '$_origin/');
  }

  void _onMessage(JavaScriptMessage msg) {
    final data = jsonDecode(msg.message) as Map<String, dynamic>;
    switch (data['e']) {
      case 'ready':
        _ready = true;
        _duration = Duration(
          milliseconds: ((data['d'] as num? ?? 0) * 1000).round(),
        );
        notifyListeners();
      case 'state':
        _state = _stateOf((data['s'] as num?)?.toInt() ?? -1);
        // 멈추면 흐른 시간도 멈춰야 위치가 앞서 나가지 않는다
        if (_state == YtState.playing) {
          _since.start();
        } else {
          _lastPos = position;
          _since
            ..stop()
            ..reset();
        }
        notifyListeners();
      case 'error':
        errorCode = (data['c'] as num?)?.toInt();
        notifyListeners();
      case 'time':
        _lastPos = Duration(
          milliseconds: ((data['t'] as num? ?? 0) * 1000).round(),
        );
        _since
          ..reset()
          ..start();
        if (_duration == Duration.zero && data['d'] != null) {
          _duration = Duration(
            milliseconds: ((data['d'] as num) * 1000).round(),
          );
        }
    }
  }

  Future<void> play() => webview.runJavaScript('play()');
  Future<void> pause() => webview.runJavaScript('pause()');

  Future<void> seekTo(Duration to) async {
    // 다음 신호가 올 때까지 옛 자리로 튀지 않게 바로 맞춰둔다
    _lastPos = to;
    _since
      ..reset()
      ..start();
    await webview.runJavaScript('seek(${to.inMilliseconds / 1000})');
  }

  Future<void> toggle() => isPlaying ? pause() : play();

  /// 재생 위치를 유지한 채 다시 띄운다 (화면을 돌려 웹뷰가 새로 만들어질 때)
  String get _html => '''
<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<meta name="referrer" content="strict-origin-when-cross-origin">
<style>
  html, body { margin:0; padding:0; height:100%; background:#000; overflow:hidden; }
  #p { width:100%; height:100%; }
</style>
</head>
<body>
<div id="p"></div>
<script src="https://www.youtube.com/iframe_api"></script>
<script>
  var player, timer;
  function send(o) { Bridge.postMessage(JSON.stringify(o)); }
  function onYouTubeIframeAPIReady() {
    player = new YT.Player('p', {
      videoId: '$videoId',
      playerVars: {
        origin: '$_origin',
        enablejsapi: 1,
        rel: 0, playsinline: 1, modestbranding: 1,
        fs: 1,            // 유튜브 기본 전체화면 버튼을 그대로 쓴다
        controls: 1
      },
      events: {
        onReady: function (e) {
          var at = ${startAt.inMilliseconds / 1000};
          if (at > 0) e.target.seekTo(at, true);
          if ($autoPlay) e.target.playVideo();
          send({ e: 'ready', d: e.target.getDuration() });
          clearInterval(timer);
          // 100ms마다 위치를 보낸다. 그 사이는 앱이 흐른 시간으로 메운다
          timer = setInterval(function () {
            if (player && player.getCurrentTime) {
              send({ e: 'time', t: player.getCurrentTime(), d: player.getDuration() });
            }
          }, 100);
        },
        onStateChange: function (e) { send({ e: 'state', s: e.data }); },
        onError: function (e) { send({ e: 'error', c: e.data }); }
      }
    });
  }
  function play() { player && player.playVideo(); }
  function pause() { player && player.pauseVideo(); }
  function seek(t) { player && player.seekTo(t, true); }
</script>
</body>
</html>
''';
}
