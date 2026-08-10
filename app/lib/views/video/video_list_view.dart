/// 영상 전체보기 — 필터 + 월 구분 그리드 + 무한 스크롤
/// (웹 pages/mobile/video/VideoList.jsx 대응)
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/constants.dart';
import '../../models/video.dart';
import '../../services/videos_service.dart';
import '../../widgets/e_motion.dart';
import 'video_widgets.dart';

const int _pageSize = 24;

class VideoListView extends StatefulWidget {
  final String category; // official | sp | variety | music | shorts

  const VideoListView({super.key, required this.category});

  @override
  State<VideoListView> createState() => _VideoListViewState();
}

class _VideoListViewState extends State<VideoListView> {
  final _scroll = ScrollController();
  final List<VideoItem> _videos = [];
  Map<String, int> _monthCounts = {};
  List<ChannelFacet> _channels = [];
  String? _categoryLabel;
  int _total = 0;
  bool _hasMore = false;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  String _channel = '';

  bool get _isShorts => widget.category == 'shorts';
  bool get _hasFilter =>
      widget.category == 'music' || widget.category == 'variety' || _isShorts;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _load(reset: true);
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_hasMore || _loadingMore || _loading) return;
    // 웹 IntersectionObserver rootMargin 600px 대응
    if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 600) {
      _load();
    }
  }

  Future<void> _load({bool reset = false}) async {
    if (reset) {
      setState(() {
        _loading = true;
        _error = null;
        _videos.clear();
      });
    } else {
      setState(() => _loadingMore = true);
    }
    try {
      final page = await getVideos(
        category: _isShorts ? null : widget.category,
        channel: _channel,
        shorts: _isShorts ? 'only' : 'exclude',
        limit: _pageSize,
        offset: reset ? 0 : _videos.length,
      );
      setState(() {
        _videos.addAll(page.videos);
        _total = page.total;
        _hasMore = page.hasMore;
        if (reset || _monthCounts.isEmpty) {
          _monthCounts = page.monthCounts;
          _channels = page.channels;
          _categoryLabel = page.categoryLabel;
        }
        _loading = false;
        _loadingMore = false;
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _loadingMore = false;
        _error = '영상을 불러오지 못했습니다';
      });
    }
  }

  /// 월별 그룹 (게시순 유지 — 웹 groups useMemo)
  List<({String ym, List<VideoItem> videos})> get _groups {
    final list = <({String ym, List<VideoItem> videos})>[];
    for (final v in _videos) {
      final ym = v.publishedAt.length >= 7 ? v.publishedAt.substring(0, 7) : '';
      if (list.isEmpty || list.last.ym != ym) {
        list.add((ym: ym, videos: []));
      }
      list.last.videos.add(v);
    }
    return list;
  }

  @override
  Widget build(BuildContext context) {
    final label =
        _isShorts ? 'SHORTS' : (_categoryLabel ?? videoCategoryKo(widget.category));

    // 전환 중 이전 화면이 비치지 않도록 페이지 자체를 불투명하게
    return ColoredBox(
      color: EColors.paper,
      child: ListView(
      controller: _scroll,
      padding: const EdgeInsets.fromLTRB(22, 26, 22, 64),
      children: [
        // 크럼 + 타이틀
        EFadeUp(
          child: Row(children: [
            GestureDetector(
              onTap: () => context.pop(),
              child: const Text('VIDEOS',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 2,
                      color: EColors.mute)),
            ),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 8),
              child: Text('/',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: EColors.faint)),
            ),
            Flexible(
              child: Text(label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 2,
                      color: appPalette.primary)),
            ),
          ]),
        ),
        const SizedBox(height: 6),
        EFadeUp(
          delayMs: kStaggerMs,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Flexible(
                child: Text(label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -1,
                        color: EColors.ink)),
              ),
              const SizedBox(width: 8),
              Text('$_total',
                  style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w800,
                      color: EColors.mute)),
            ],
          ),
        ),

        // 필터 (음방·예능·쇼츠 = 채널 드롭다운)
        const SizedBox(height: 16),
        if (_hasFilter)
          Container(
            decoration: const BoxDecoration(
              border: Border(
                top: BorderSide(color: EColors.ink, width: 2),
                bottom: BorderSide(color: EColors.hairline),
              ),
            ),
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: _ChannelSelect(
              channels: _channels,
              value: _channel,
              onChange: (v) {
                setState(() {
                  _channel = v;
                  _monthCounts = {};
                });
                _load(reset: true);
              },
            ),
          )
        else
          Container(height: 2, color: EColors.ink),

        // 본문
        if (_loading)
          const Padding(
            padding: EdgeInsets.only(top: 80),
            child: Center(
              child: CircularProgressIndicator(color: EColors.ink, strokeWidth: 2.5),
            ),
          )
        else if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 80),
            child: Center(
              child: Text(_error!,
                  style: const TextStyle(fontSize: 13.5, color: EColors.mute)),
            ),
          )
        else if (_videos.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 80),
            child: Center(
              child: Text('조건에 맞는 영상이 없습니다.',
                  style: TextStyle(fontSize: 13.5, color: EColors.mute)),
            ),
          )
        else
          // 월 그룹 단위로 스크롤 진입 시 페이드업 (웹 Reveal)
          for (final g in _groups)
            EReveal(
              key: ValueKey('vg-${g.ym}'),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
            // 월 구분선
            Padding(
              padding: const EdgeInsets.only(top: 28, bottom: 12),
              child: Row(children: [
                Text(g.ym.replaceAll('-', '. '),
                    style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1,
                        color: EColors.ink,
                        fontFeatures: [FontFeature.tabularFigures()])),
                const SizedBox(width: 12),
                Expanded(
                  child: CustomPaint(
                    size: const Size(double.infinity, 1),
                    painter: _DashedLinePainter(),
                  ),
                ),
                const SizedBox(width: 12),
                Text('${_monthCounts[g.ym] ?? g.videos.length}개',
                    style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: EColors.mute)),
              ]),
            ),
            LayoutBuilder(builder: (context, constraints) {
              final cols = _isShorts ? 3 : 2;
              final gap = _isShorts ? 10.0 : 12.0;
              final w = (constraints.maxWidth - gap * (cols - 1)) / cols;
              return Wrap(
                spacing: gap,
                runSpacing: _isShorts ? 16 : 20,
                children: [
                  for (final v in g.videos)
                    SizedBox(
                      width: w,
                      child: _isShorts
                          ? ShortsCard(video: v)
                          : VideoCard(
                              video: v,
                              showChannel: widget.category == 'music' ||
                                  widget.category == 'variety',
                            ),
                    ),
                ],
              );
            }),
                ],
              ),
            ),

        if (_loadingMore)
          const Padding(
            padding: EdgeInsets.only(top: 32),
            child: Center(
              child: Text('불러오는 중...',
                  style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: EColors.mute)),
            ),
          ),
      ],
      ),
    );
  }
}

/// 점선 구분선 (웹 border-dashed border-faint-light)
class _DashedLinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = EColors.faintLight
      ..strokeWidth = 1;
    double x = 0;
    while (x < size.width) {
      canvas.drawLine(Offset(x, 0), Offset(x + 4, 0), paint);
      x += 7;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// 채널 선택 드롭다운 — 웹 ChannelSelect와 동일한 앵커 드롭다운
/// (바텀시트가 아니라 버튼 바로 아래에 펼쳐진다)
class _ChannelSelect extends StatefulWidget {
  final List<ChannelFacet> channels;
  final String value;
  final ValueChanged<String> onChange;

  const _ChannelSelect({
    required this.channels,
    required this.value,
    required this.onChange,
  });

  @override
  State<_ChannelSelect> createState() => _ChannelSelectState();
}

class _ChannelSelectState extends State<_ChannelSelect> {
  final _portal = OverlayPortalController();
  final _link = LayerLink();
  double _width = 0;

  void _toggle() {
    final box = context.findRenderObject() as RenderBox?;
    if (box != null) _width = box.size.width;
    setState(() => _portal.isShowing ? _portal.hide() : _portal.show());
  }

  void _select(String v) {
    setState(() => _portal.hide());
    widget.onChange(v);
  }

  Widget _item(String label, int? count, String v, bool active,
      {bool topBorder = false}) {
    return InkWell(
      onTap: () => _select(v),
      child: Container(
        decoration: BoxDecoration(
          color: active ? EColors.paper : Colors.white,
          border: topBorder
              ? const Border(top: BorderSide(color: EColors.hairline))
              : null,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        child: Row(children: [
          Expanded(
            child: Text(label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: active ? EColors.ink : EColors.esub)),
          ),
          if (count != null)
            Text('$count',
                style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: EColors.mute)),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final current =
        widget.channels.where((c) => c.name == widget.value).firstOrNull;

    return CompositedTransformTarget(
      link: _link,
      child: OverlayPortal(
        controller: _portal,
        overlayChildBuilder: (context) => Stack(children: [
          // 바깥 탭으로 닫기
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => setState(() => _portal.hide()),
            ),
          ),
          CompositedTransformFollower(
            link: _link,
            targetAnchor: Alignment.bottomLeft,
            offset: const Offset(0, 2),
            child: SizedBox(
              width: _width,
              child: Container(
                constraints: const BoxConstraints(maxHeight: 320),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: EColors.ink),
                  boxShadow: [
                    BoxShadow(
                      color: EColors.ink.withValues(alpha: 0.18),
                      blurRadius: 50,
                      offset: const Offset(0, 20),
                    ),
                  ],
                ),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _item('전체 채널', null, '', widget.value.isEmpty),
                      for (final c in widget.channels)
                        _item(c.name, c.count, c.name, widget.value == c.name,
                            topBorder: true),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ]),
        child: GestureDetector(
          onTap: _toggle,
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: EColors.hairline),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            child: Row(children: [
              Expanded(
                child: Text(
                  current != null
                      ? '${current.name} (${current.count})'
                      : '전체 채널',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: EColors.ink),
                ),
              ),
              AnimatedRotation(
                turns: _portal.isShowing ? 0.5 : 0,
                duration: const Duration(milliseconds: 150),
                child: const Icon(LucideIcons.chevronDown,
                    size: 14, color: EColors.mute),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
