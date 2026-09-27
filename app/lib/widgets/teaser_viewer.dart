/// 티저 뷰어 (이미지 + 동영상) — 앨범 상세에서 분리한 공용 위젯
library;

import 'package:flutter/material.dart';
import 'content_image.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:chewie/chewie.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:photo_view/photo_view.dart';
import 'package:photo_view/photo_view_gallery.dart';
import 'package:video_player/video_player.dart';
import '../models/album.dart';
import '../services/download_service.dart';
import 'photo_lightbox.dart';

/// 티저 뷰어 열기
void showTeaserViewer(
  BuildContext context,
  List<Teaser> teasers,
  int initialIndex,
) {
  if (teasers.isEmpty) return;
  Navigator.of(context).push(
    PageRouteBuilder(
      opaque: false,
      barrierColor: Colors.black,
      pageBuilder: (_, _, _) =>
          TeaserViewer(teasers: teasers, initialIndex: initialIndex),
      transitionsBuilder: (_, animation, _, child) =>
          FadeTransition(opacity: animation, child: child),
      transitionDuration: MediaQuery.disableAnimationsOf(context)
          ? Duration.zero
          : const Duration(milliseconds: 200),
    ),
  );
}

/// 티저 뷰어 (이미지 + 동영상 지원)
class TeaserViewer extends StatefulWidget {
  final List<Teaser> teasers;
  final int initialIndex;

  const TeaserViewer({
    super.key,
    required this.teasers,
    required this.initialIndex,
  });

  @override
  State<TeaserViewer> createState() => TeaserViewerState();
}

class TeaserViewerState extends State<TeaserViewer> {
  late PageController _pageController;
  late int _currentIndex;
  final Map<int, int> _attempts = {};
  bool _downloading = false;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  /// 다운로드 (이미지 또는 동영상)
  Future<void> _download() async {
    if (_downloading) return;
    final teaser = widget.teasers[_currentIndex];
    final isVideo = teaser.mediaType == 'video';
    final url = isVideo
        ? (teaser.videoUrl ?? teaser.originalUrl)
        : teaser.originalUrl;
    if (url == null || url.isEmpty) return;

    setState(() => _downloading = true);
    try {
      final taskId = await downloadImage(url);
      if (taskId == null) throw StateError('Download did not start');
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('다운로드를 시작합니다')));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('다운로드를 시작하지 못했습니다. 다시 시도해주세요.')),
        );
      }
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final topPadding = MediaQuery.of(context).padding.top;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Stack(
          children: [
            // 갤러리
            Padding(
              padding: EdgeInsets.only(
                top: topPadding + 60,
                bottom: bottomPadding + 56,
              ),
              child: PhotoViewGallery.builder(
                pageController: _pageController,
                itemCount: widget.teasers.length,
                allowImplicitScrolling: true,
                onPageChanged: (index) {
                  setState(() => _currentIndex = index);
                },
                backgroundDecoration: const BoxDecoration(color: Colors.black),
                builder: (context, index) {
                  final teaser = widget.teasers[index];
                  final isVideoItem = teaser.mediaType == 'video';

                  // 동영상인 경우 Chewie 플레이어로 재생
                  if (isVideoItem) {
                    return PhotoViewGalleryPageOptions.customChild(
                      child: index == _currentIndex
                          ? _VideoTeaserPage(
                              key: ValueKey(index),
                              teaser: teaser,
                            )
                          : const SizedBox.shrink(),
                    );
                  }

                  // 이미지인 경우
                  final imageUrl = teaser.thumbUrl ?? teaser.originalUrl;
                  if (imageUrl == null || imageUrl.isEmpty) {
                    return PhotoViewGalleryPageOptions.customChild(
                      child: const Center(
                        child: Icon(
                          LucideIcons.imageOff,
                          color: Colors.white54,
                          size: 64,
                        ),
                      ),
                    );
                  }

                  // 이미지인 경우 PhotoView 사용
                  return PhotoViewGalleryPageOptions(
                    imageProvider: CachedNetworkImageProvider(
                      teaser.originalUrl ?? imageUrl,
                      cacheKey:
                          '${teaser.originalUrl ?? imageUrl}:attempt:${_attempts[index] ?? 0}',
                    ),
                    errorBuilder: (_, _, _) => MediaRetry(
                      onRetry: () => setState(() {
                        _attempts[index] = (_attempts[index] ?? 0) + 1;
                      }),
                    ),
                    minScale: PhotoViewComputedScale.contained,
                    maxScale: PhotoViewComputedScale.covered * 3,
                    initialScale: PhotoViewComputedScale.contained,
                    heroAttributes: PhotoViewHeroAttributes(
                      tag: 'teaser_$index',
                    ),
                  );
                },
                loadingBuilder: (context, event) => const Center(
                  child: CircularProgressIndicator(
                    color: Colors.white54,
                    strokeWidth: 2,
                  ),
                ),
              ),
            ),
            // 상단 헤더
            Positioned(
              top: topPadding + 8,
              left: 0,
              right: 0,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    // 왼쪽: 닫기 버튼
                    Expanded(
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: GestureDetector(
                          onTap: () => Navigator.pop(context),
                          child: const Padding(
                            padding: EdgeInsets.all(4),
                            child: Icon(
                              LucideIcons.x,
                              color: Colors.white70,
                              size: 24,
                            ),
                          ),
                        ),
                      ),
                    ),
                    // 가운데: 페이지 번호
                    if (widget.teasers.length > 1)
                      Text(
                        '${_currentIndex + 1} / ${widget.teasers.length}',
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 14,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    // 오른쪽: 다운로드 버튼
                    Expanded(
                      child: Align(
                        alignment: Alignment.centerRight,
                        child: GestureDetector(
                          onTap: _downloading ? null : _download,
                          child: const Padding(
                            padding: EdgeInsets.all(4),
                            child: Icon(
                              LucideIcons.download,
                              color: Colors.white70,
                              size: 22,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            // 하단 인디케이터
            if (widget.teasers.length > 1)
              Positioned(
                bottom: bottomPadding + 16,
                left: 0,
                right: 0,
                child: SlidingIndicator(
                  count: widget.teasers.length,
                  currentIndex: _currentIndex,
                  onTap: (index) {
                    _pageController.animateToPage(
                      index,
                      duration: MediaQuery.disableAnimationsOf(context)
                          ? Duration.zero
                          : const Duration(milliseconds: 300),
                      curve: Curves.easeOut,
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// 동영상 티저 페이지 (Chewie로 내부 재생)
class _VideoTeaserPage extends StatefulWidget {
  final Teaser teaser;

  const _VideoTeaserPage({super.key, required this.teaser});

  @override
  State<_VideoTeaserPage> createState() => _VideoTeaserPageState();
}

class _VideoTeaserPageState extends State<_VideoTeaserPage> {
  VideoPlayerController? _videoController;
  ChewieController? _chewieController;
  bool _isInitialized = false;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    _initializePlayer();
  }

  Future<void> _initializePlayer() async {
    final videoUrl = widget.teaser.videoUrl ?? widget.teaser.originalUrl;
    if (videoUrl == null) {
      setState(() => _hasError = true);
      return;
    }

    try {
      final videoController = VideoPlayerController.networkUrl(
        Uri.parse(videoUrl),
      );
      _videoController = videoController;

      await videoController.initialize().timeout(const Duration(seconds: 20));
      if (!mounted || !identical(_videoController, videoController)) return;

      final chewieController = ChewieController(
        videoPlayerController: videoController,
        autoPlay: true,
        looping: false,
        showControls: true,
        allowFullScreen: false,
        allowMuting: true,
        showOptions: false,
        placeholder: Container(color: Colors.black),
        errorBuilder: (_, _) =>
            MediaRetry(message: '동영상을 재생할 수 없습니다.', onRetry: _retry),
      );
      _chewieController = chewieController;

      if (mounted) {
        setState(() => _isInitialized = true);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _hasError = true);
      }
    }
  }

  void _retry() {
    _chewieController?.dispose();
    _chewieController = null;
    _videoController?.dispose();
    _videoController = null;
    setState(() {
      _hasError = false;
      _isInitialized = false;
    });
    _initializePlayer();
  }

  @override
  void dispose() {
    _chewieController?.dispose();
    _videoController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_hasError) {
      return MediaRetry(message: '동영상을 불러오지 못했습니다.', onRetry: _retry);
    }

    if (!_isInitialized || _chewieController == null) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.white54, strokeWidth: 2),
      );
    }

    return Center(
      child: AspectRatio(
        aspectRatio: _videoController!.value.aspectRatio,
        child: Chewie(controller: _chewieController!),
      ),
    );
  }
}
