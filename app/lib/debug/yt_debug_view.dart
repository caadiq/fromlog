/// 유튜브 재생 진단 화면 (임시).
///
/// 같은 폰에서 패키지는 되고 자체 구현은 152로 막힌다 — 원인을 확정하려면
/// 두 구현이 실제로 만드는 임베드 주소(iframe src)를 나란히 봐야 한다.
/// 주소의 차이가 곧 원인이다. 유튜브가 콘솔에 적는 이유도 함께 띄운다.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart' as pkg;

import 'yt_probe_controller.dart';

const _videoId = '17tMsblcNh4'; // Vitamin ME MV

class YtDebugView extends StatefulWidget {
  const YtDebugView({super.key});

  @override
  State<YtDebugView> createState() => _YtDebugViewState();
}

class _YtDebugViewState extends State<YtDebugView> {
  late final pkg.YoutubePlayerController _pkg;
  late final YtProbeController _probe;
  Timer? _timer;

  String _pkgInfo = '수집 중…';
  String _probeInfo = '수집 중…';
  String _diff = '';

  @override
  void initState() {
    super.initState();
    _pkg = pkg.YoutubePlayerController.fromVideoId(
      videoId: _videoId,
      autoPlay: false,
      params: const pkg.YoutubePlayerParams(
        showFullscreenButton: true,
        strictRelatedVideos: true,
      ),
    );
    _probe = YtProbeController(videoId: _videoId);
    _timer = Timer.periodic(const Duration(seconds: 3), (_) => _collect());
  }

  /// 각 웹뷰에서 문서 주소와 임베드 iframe 주소를 꺼낸다
  Future<String> _inspect(WebViewController web) async {
    try {
      final raw = await web.runJavaScriptReturningResult('''
        JSON.stringify({
          doc: document.location.href,
          iframe: (function () {
            var f = document.getElementsByTagName('iframe')[0];
            return f ? f.src : '(iframe 없음)';
          })(),
          ua: navigator.userAgent
        })
      ''');
      var s = raw.toString();
      // 안드로이드는 JSON 문자열을 한 번 더 감싼 채 돌려준다
      if (s.startsWith('"')) {
        s = s
            .substring(1, s.length - 1)
            .replaceAll(r'\"', '"')
            .replaceAll(r'\\', r'\');
      }
      return s;
    } catch (e) {
      return '오류: $e';
    }
  }

  Future<void> _collect() async {
    final a = await _inspect(_pkg.webViewController);
    final b = await _inspect(_probe.webview);
    if (!mounted) return;
    setState(() {
      _pkgInfo = a;
      _probeInfo = b;
      _diff = _diffParams(a, b);
    });
  }

  /// 두 iframe 주소의 쿼리를 비교해 다른 항목만 추린다
  String _diffParams(String a, String b) {
    Uri? parse(String s) {
      final m = RegExp('"iframe":"([^"]+)"').firstMatch(s);
      if (m == null) return null;
      return Uri.tryParse(m.group(1)!);
    }

    final ua = parse(a);
    final ub = parse(b);
    if (ua == null || ub == null) return '(아직 비교 불가)';

    final out = StringBuffer();
    if (ua.host != ub.host) out.writeln('host: ${ua.host} ↔ ${ub.host}');
    if (ua.path != ub.path) out.writeln('path: ${ua.path} ↔ ${ub.path}');
    final keys = {...ua.queryParameters.keys, ...ub.queryParameters.keys};
    for (final k in keys) {
      final va = ua.queryParameters[k];
      final vb = ub.queryParameters[k];
      if (va != vb) out.writeln('$k: ${va ?? '(없음)'} ↔ ${vb ?? '(없음)'}');
    }
    return out.isEmpty ? '(쿼리 차이 없음)' : out.toString();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pkg.close();
    _probe.dispose();
    super.dispose();
  }

  Widget _block(String title, Widget child) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        child,
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('YT 진단')),
      body: ListView(
        children: [
          _block('① 패키지 (재생됨)',
              AspectRatio(aspectRatio: 16 / 9, child: pkg.YoutubePlayer(controller: _pkg))),
          _block('② 자체 구현 (152)',
              AspectRatio(aspectRatio: 16 / 9, child: WebViewWidget(controller: _probe.webview))),
          _block('임베드 주소 차이 (← 이것이 원인)',
              SelectableText(_diff, style: const TextStyle(fontSize: 12))),
          _block('① 상세', SelectableText(_pkgInfo, style: const TextStyle(fontSize: 10))),
          _block('② 상세', SelectableText(_probeInfo, style: const TextStyle(fontSize: 10))),
          _block('② 콘솔 (유튜브가 적은 이유)',
              ListenableBuilder(
                listenable: _probe,
                builder: (_, _) => SelectableText(
                  _probe.consoleLines.isEmpty ? '(없음)' : _probe.consoleLines.join('\n'),
                  style: const TextStyle(fontSize: 10),
                ),
              )),
          const SizedBox(height: 40),
        ],
      ),
    );
  }
}
