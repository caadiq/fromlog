/// 이미지 라이트박스 (검정 배경 + 스와이프 + 점 인디케이터)
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// 라이트박스 열기
void showImageLightbox(
  BuildContext context,
  List<String> urls,
  int initialIndex,
) {
  if (urls.isEmpty) return;
  Navigator.of(context).push(
    PageRouteBuilder(
      opaque: false,
      barrierColor: Colors.black,
      pageBuilder: (_, _, _) =>
          ImageLightbox(urls: urls, initialIndex: initialIndex),
      transitionsBuilder: (_, animation, _, child) =>
          FadeTransition(opacity: animation, child: child),
      transitionDuration: const Duration(milliseconds: 140),
      reverseTransitionDuration: const Duration(milliseconds: 140),
    ),
  );
}

/// X 이미지 라이트박스 (검정 배경 + 스와이프 + 점 인디케이터)
class ImageLightbox extends StatefulWidget {
  final List<String> urls;
  final int initialIndex;

  const ImageLightbox({
    super.key,
    required this.urls,
    required this.initialIndex,
  });

  @override
  State<ImageLightbox> createState() => ImageLightboxState();
}

class ImageLightboxState extends State<ImageLightbox> {
  late final PageController _controller;
  late int _index;

  /// 페이지별 확대/이동 컨트롤러 (핀치줌)
  final Map<int, TransformationController> _transformers = {};

  /// 현재 페이지가 확대(scale>1)된 상태 — PageView 스와이프 차단
  bool _zoomed = false;

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex < 0 ? 0 : widget.initialIndex;
    _controller = PageController(initialPage: _index);
  }

  @override
  void dispose() {
    _controller.dispose();
    for (final t in _transformers.values) {
      t.dispose();
    }
    super.dispose();
  }

  TransformationController _transformerFor(int i) =>
      _transformers.putIfAbsent(i, () => TransformationController());

  void _syncZoom(int i) {
    final scale = _transformerFor(i).value.getMaxScaleOnAxis();
    final z = scale > 1.02;
    if (z != _zoomed) setState(() => _zoomed = z);
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      // 갤러리 라이트박스와 동일하게 소프트키·상태바를 검정(라이트 아이콘)으로
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Stack(
          children: [
            PageView.builder(
              controller: _controller,
              itemCount: widget.urls.length,
              physics: _zoomed
                  ? const NeverScrollableScrollPhysics()
                  : const PageScrollPhysics(),
              onPageChanged: (i) {
                // 이전 페이지 확대 초기화
                for (final t in _transformers.values) {
                  t.value = Matrix4.identity();
                }
                setState(() {
                  _index = i;
                  _zoomed = false;
                });
              },
              itemBuilder: (context, i) => GestureDetector(
                // 더블탭 확대/축소 토글
                onDoubleTap: () {
                  final t = _transformerFor(i);
                  final zoomedNow = t.value.getMaxScaleOnAxis() > 1.02;
                  t.value = zoomedNow
                      ? Matrix4.identity()
                      : (Matrix4.identity()..scale(2.5));
                  setState(() => _zoomed = !zoomedNow);
                },
                child: InteractiveViewer(
                  transformationController: _transformerFor(i),
                  minScale: 1,
                  maxScale: 5,
                  panEnabled: _zoomed, // 확대 시에만 팬 (평소엔 좌우 스와이프)
                  onInteractionUpdate: (_) => _syncZoom(i),
                  onInteractionEnd: (_) => _syncZoom(i),
                  child: Center(
                    child: CachedNetworkImage(
                      imageUrl: widget.urls[i],
                      fit: BoxFit.contain,
                      placeholder: (_, _) => const SizedBox(
                        width: 28,
                        height: 28,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white54,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            // 닫기
            Positioned(
              top: MediaQuery.of(context).padding.top + 8,
              right: 12,
              child: IconButton(
                icon: const Icon(Icons.close, size: 28, color: Colors.white70),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
            // 점 인디케이터 (2장 이상)
            if (widget.urls.length > 1)
              Positioned(
                left: 0,
                right: 0,
                bottom: MediaQuery.of(context).padding.bottom + 24,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (var i = 0; i < widget.urls.length; i++)
                      Container(
                        width: 8,
                        height: 8,
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        decoration: BoxDecoration(
                          color: i == _index
                              ? Colors.white
                              : Colors.white.withValues(alpha: 0.4),
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
