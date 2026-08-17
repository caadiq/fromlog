/// 응원법 — 영상 재생에 맞춰 가사와 응원법을 따라간다
/// (웹 pages/mobile/album/Fanchant.jsx + components/common/FanchantLyrics.jsx 대응)
///
/// 웹은 유튜브 IFrame API에서 재생 시각을 받아오지만 앱은 플레이어가 네이티브라
/// controller.currentPosition을 그대로 읽는다 — 중간에 끼는 것이 없어 더 정확하다.
library;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:omni_video_player/omni_video_player.dart';

import '../../core/constants.dart';
import '../../core/fanchant_progress.dart';
import '../../models/fanchant.dart';
import '../../services/albums_service.dart';
import '../../services/fanchant_service.dart';
import '../../widgets/e_motion.dart';

class FanchantView extends StatefulWidget {
  final String albumName;
  final String trackTitle;

  const FanchantView({
    super.key,
    required this.albumName,
    required this.trackTitle,
  });

  @override
  State<FanchantView> createState() => _FanchantViewState();
}

class _FanchantViewState extends State<FanchantView>
    with SingleTickerProviderStateMixin {
  late Future<Fanchant> _future;
  OmniPlaybackController? _player;
  Ticker? _ticker;

  FanchantProgress? _progress;
  final Map<int, GlobalKey> _paraKeys = {};
  final ScrollController _scroll = ScrollController();

  int _cur = -1; // 지금 조각
  Set<int> _active = const {}; // 강조할 조각들
  Set<int> _activeLines = const {}; // 왼쪽 세로 바를 그릴 줄
  ({int li, int pi})? _activeCall; // 지금 외칠 응원법
  int _lastPara = -1;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Fanchant> _load() async {
    // 주소는 곡 상세와 같은 결이라 곡을 먼저 찾아 id를 얻는다
    final track = await getTrack(widget.albumName, widget.trackTitle);
    final data = await getFanchant(track.id);
    _prepare(data);
    return data;
  }

  /// 진행 계산기를 만들고 문단마다 스크롤 기준점을 둔다
  void _prepare(Fanchant data) {
    final progress = FanchantProgress(data.lines);
    _progress = progress;
    _paraKeys.clear();
    for (var i = 0; i < progress.paragraphs.length; i++) {
      _paraKeys[i] = GlobalKey();
    }
  }

  void _attach(OmniPlaybackController c) {
    _player = c;
    _ticker?.dispose();
    // 매 프레임 위치를 읽되, 강조 대상이 실제로 바뀔 때만 다시 그린다
    _ticker = createTicker((_) => _sync())..start();
  }

  void _sync() {
    final progress = _progress;
    final player = _player;
    if (progress == null || player == null || !mounted) return;

    final time = player.currentPosition.inMilliseconds / 1000.0;
    final cur = progress.indexAt(time);
    if (cur == _cur) return; // 같은 자리면 그릴 것이 없다

    final frame = progress.frameAt(time);
    _cur = frame.cur;
    _activeCall = frame.call;
    _active = frame.active;
    _activeLines = frame.lines;
    setState(() {});
    _scrollToPara();
  }

  /// 문단째로 옮긴다 — 줄 단위로 가운데를 맞추면 문단 앞머리의 응원법이 위로 사라진다
  void _scrollToPara() {
    if (_cur < 0) return;
    final para = _progress!.paragraphOfLine[_progress!.flat[_cur].li];
    if (para == null || para == _lastPara) return;
    _lastPara = para;

    final ctx = _paraKeys[para]?.currentContext;
    if (ctx == null) return;
    Scrollable.ensureVisible(
      ctx,
      alignment: 0.35, // 다음 가사가 아래로 보이도록 조금 위쪽에
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeOutCubic,
    );
  }

  void _seek(double t) {
    _player?.seekTo(Duration(milliseconds: (t * 1000).round()));
    _player?.play();
  }

  @override
  void dispose() {
    _ticker?.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EColors.paper,
      body: SafeArea(
        child: FutureBuilder<Fanchant>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(
                child: CircularProgressIndicator(
                  color: EColors.ink,
                  strokeWidth: 2.5,
                ),
              );
            }
            if (snapshot.hasError || !snapshot.hasData) return _notFound();
            return _body(snapshot.data!);
          },
        ),
      ),
    );
  }

  Widget _notFound() => Center(
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 30),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            '404',
            style: TextStyle(
              fontSize: 58,
              fontWeight: FontWeight.w900,
              height: 1,
              letterSpacing: -3,
              color: EColors.faintLight,
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            '응원법이 없습니다',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          const Text(
            '이 곡은 공식 응원법 영상이 없거나\n아직 등록되지 않았습니다.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13.5, height: 1.6, color: EColors.mute),
          ),
          const SizedBox(height: 26),
          OutlinedButton(
            onPressed: () => context.pop(),
            style: OutlinedButton.styleFrom(
              foregroundColor: EColors.ink,
              side: const BorderSide(color: EColors.ink),
              shape: const RoundedRectangleBorder(),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            ),
            child: const Text(
              '← 이전',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    ),
  );

  Widget _body(Fanchant data) {
    return Column(
      children: [
        // 상단 바
        Container(
          decoration: const BoxDecoration(
            border: Border(
              bottom: BorderSide(color: EColors.hairline, width: 1),
            ),
          ),
          child: Row(
            children: [
              IconButton(
                onPressed: () => context.pop(),
                icon: const Icon(
                  LucideIcons.chevronLeft,
                  size: 22,
                  color: EColors.esub,
                ),
              ),
              Expanded(
                child: Text(
                  '${data.albumTitle.toUpperCase()} / 응원법',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 2.5,
                    color: EColors.mute,
                  ),
                ),
              ),
            ],
          ),
        ),

        // 영상 — 위에 고정하고 아래 가사만 흐른다
        AspectRatio(
          aspectRatio: 16 / 9,
          child: Container(
            color: EColors.ink,
            child: OmniVideoPlayer(
              configuration: VideoPlayerConfiguration(
                videoSourceConfiguration: VideoSourceConfiguration.youtube(
                  videoUrl: Uri.parse(
                    'https://www.youtube.com/watch?v=${data.videoId}',
                  ),
                  preferredQualities: [OmniVideoQuality.high720],
                ),
              ),
              callbacks: VideoPlayerCallbacks(onControllerCreated: _attach),
            ),
          ),
        ),

        Expanded(
          child: SingleChildScrollView(
            controller: _scroll,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(22, 20, 22, 60),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  EReveal(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          data.trackTitle,
                          style: const TextStyle(
                            fontSize: 25,
                            fontWeight: FontWeight.w900,
                            height: 1.15,
                            letterSpacing: -1,
                          ),
                        ),
                        const SizedBox(height: 18),
                        Container(
                          padding: const EdgeInsets.only(bottom: 12),
                          decoration: const BoxDecoration(
                            border: Border(
                              bottom: BorderSide(color: EColors.ink, width: 2),
                            ),
                          ),
                          width: double.infinity,
                          child: const Text(
                            'FANCHANT',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 2.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  ..._paragraphs(data),
                  const SizedBox(height: 26),
                  const Text(
                    '가사를 누르면 그 지점부터 다시 들을 수 있어요.',
                    style: TextStyle(
                      fontSize: 12,
                      height: 1.6,
                      color: EColors.faint,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  List<Widget> _paragraphs(Fanchant data) {
    final out = <Widget>[];
    final paras = _progress!.paragraphs;
    for (var pi = 0; pi < paras.length; pi++) {
      final range = paras[pi];
      out.add(
        Container(
          key: _paraKeys[pi],
          margin: EdgeInsets.only(top: pi == 0 ? 0 : 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var li = range[0]; li <= range[1]; li++)
                if (!data.lines[li].gap) _lineWidget(data, li),
            ],
          ),
        ),
      );
    }
    return out;
  }

  Widget _lineWidget(Fanchant data, int li) {
    final line = data.lines[li];
    final onBar = _activeLines.contains(li);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 지금 진행 중인 줄 표시
          Container(
            width: 3,
            height: 21,
            margin: const EdgeInsets.only(top: 3, right: 15),
            color: onBar ? data.callColor : Colors.transparent,
          ),
          // 조각을 위젯으로 늘어놓는다 — 응원법에 여백·테두리를 주려면 글자만으로는 안 된다.
          // 긴 응원법은 이 안에서 다시 접히므로 배경이 두 줄에 걸쳐 그려진다.
          Expanded(
            child: Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              runSpacing: 2,
              children: [
                for (var pi = 0; pi < line.parts.length; pi++)
                  _partWidget(data, li, pi),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _partWidget(Fanchant data, int li, int pi) {
    final part = data.lines[li].parts[pi];
    final idx = _progress!.rank['$li-$pi'] ?? -1;
    final isNow = _active.contains(idx);
    final passed = _cur >= 0 && idx >= 0 && idx < _cur && !isNow;

    // 조각에 시각이 없으면 줄 시각으로 되돌아간다
    final t = part.t ?? data.lines[li].t;

    Widget wrapTap(Widget child) => t == null
        ? child
        : GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => _seek(t),
            child: child,
          );

    if (!part.isCall) {
      return wrapTap(
        AnimatedDefaultTextStyle(
          duration: const Duration(milliseconds: 150),
          style: TextStyle(
            fontSize: 15,
            height: 1.75,
            color: isNow
                ? EColors.ink
                : (passed ? const Color(0xFFCFCFCF) : const Color(0xFFB4B4B4)),
            fontWeight: isNow ? FontWeight.w800 : FontWeight.w600,
          ),
          child: Text(part.text),
        ),
      );
    }

    // 지금 외칠 응원법이면 배경·테두리가 들어온다 (웹과 같은 모양)
    final on = _activeCall?.li == li && _activeCall?.pi == pi;
    final color = part.type == 'sing' ? data.singColor : data.callColor;
    return wrapTap(
      AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeOut,
        padding: on
            ? const EdgeInsets.symmetric(horizontal: 8, vertical: 2)
            : EdgeInsets.zero,
        decoration: on
            ? BoxDecoration(
                color: color.withValues(alpha: 0.13),
                borderRadius: BorderRadius.circular(3),
                border: Border.all(color: color.withValues(alpha: 0.2)),
              )
            : null,
        child: Text(
          part.text,
          style: TextStyle(
            fontSize: 15,
            height: 1.75,
            fontWeight: FontWeight.w900,
            color: on ? color : color.withValues(alpha: passed ? 0.45 : 1.0),
          ),
        ),
      ),
    );
  }

}

