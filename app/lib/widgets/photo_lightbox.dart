/// 사진 라이트박스 공용 뷰어 — 앨범 갤러리 뷰어(_ConceptPhotoViewer)를 공용화
/// 핀치 줌(photo_view) + 카운터 + 정보 시트 + 원본 다운로드 + 슬라이딩 인디케이터
library;


import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:photo_view/photo_view.dart';
import 'package:photo_view/photo_view_gallery.dart';
import '../core/constants.dart';
import '../services/download_service.dart';

/// 라이트박스에 표시할 사진 항목
class LightboxPhoto {
  final String? mediumUrl;
  final String? originalUrl;

  /// 정보 시트용 (없으면 정보 버튼 숨김)
  final String? members;
  final String? concept;
  final String? albumTitle;

  const LightboxPhoto({
    this.mediumUrl,
    this.originalUrl,
    this.members,
    this.concept,
    this.albumTitle,
  });

  bool get hasInfo =>
      (members != null && members!.isNotEmpty) ||
      (concept != null && concept!.isNotEmpty) ||
      (albumTitle != null && albumTitle!.isNotEmpty);
}

/// 라이트박스 열기
void showPhotoLightbox(
  BuildContext context,
  List<LightboxPhoto> photos,
  int initialIndex, {
  String heroPrefix = 'lightbox_photo',
}) {
  if (photos.isEmpty) return;
  Navigator.of(context).push(
    PageRouteBuilder(
      opaque: false,
      barrierColor: Colors.black,
      pageBuilder: (_, _, _) => PhotoLightbox(
        photos: photos,
        initialIndex: initialIndex,
        heroPrefix: heroPrefix,
      ),
      transitionsBuilder: (_, animation, _, child) =>
          FadeTransition(opacity: animation, child: child),
      transitionDuration: const Duration(milliseconds: 200),
    ),
  );
}

class PhotoLightbox extends StatefulWidget {
  final List<LightboxPhoto> photos;
  final int initialIndex;
  final String heroPrefix;

  const PhotoLightbox({
    super.key,
    required this.photos,
    required this.initialIndex,
    this.heroPrefix = 'lightbox_photo',
  });

  @override
  State<PhotoLightbox> createState() => _PhotoLightboxState();
}

class _PhotoLightboxState extends State<PhotoLightbox> {
  late PageController _pageController;
  late int _currentIndex;

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

  /// 이미지 다운로드 (원본 우선)
  Future<void> _downloadImage() async {
    final photo = widget.photos[_currentIndex];
    final imageUrl = photo.originalUrl ?? photo.mediumUrl;
    if (imageUrl == null || imageUrl.isEmpty) return;

    final taskId = await downloadImage(imageUrl);
    if (taskId != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('다운로드를 시작합니다'),
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  bool get _hasInfo => widget.photos[_currentIndex].hasInfo;

  /// Info 바텀시트 표시
  void _showInfoSheet() {
    final photo = widget.photos[_currentIndex];
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => _InfoBottomSheet(photo: photo),
    );
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
            PhotoViewGallery.builder(
              pageController: _pageController,
              itemCount: widget.photos.length,
              allowImplicitScrolling: true, // 인접 페이지 미리 빌드
              onPageChanged: (index) {
                setState(() => _currentIndex = index);
              },
              backgroundDecoration: const BoxDecoration(color: Colors.black),
              builder: (context, index) {
                final photo = widget.photos[index];
                final imageUrl = photo.mediumUrl ?? photo.originalUrl;

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

                return PhotoViewGalleryPageOptions(
                  imageProvider: CachedNetworkImageProvider(
                    photo.originalUrl ?? imageUrl,
                  ),
                  minScale: PhotoViewComputedScale.contained,
                  maxScale: PhotoViewComputedScale.covered * 3,
                  initialScale: PhotoViewComputedScale.contained,
                  heroAttributes: PhotoViewHeroAttributes(
                    tag: '${widget.heroPrefix}_$index',
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
                    if (widget.photos.length > 1)
                      Text(
                        '${_currentIndex + 1} / ${widget.photos.length}',
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 14,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    // 오른쪽: 정보 버튼 + 다운로드 버튼
                    Expanded(
                      child: Align(
                        alignment: Alignment.centerRight,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (_hasInfo)
                              GestureDetector(
                                onTap: _showInfoSheet,
                                child: const Padding(
                                  padding: EdgeInsets.all(4),
                                  child: Icon(
                                    LucideIcons.info,
                                    color: Colors.white70,
                                    size: 22,
                                  ),
                                ),
                              ),
                            const SizedBox(width: 8),
                            GestureDetector(
                              onTap: _downloadImage,
                              child: const Padding(
                                padding: EdgeInsets.all(4),
                                child: Icon(
                                  LucideIcons.download,
                                  color: Colors.white70,
                                  size: 22,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            // 하단 인디케이터
            if (widget.photos.length > 1)
              Positioned(
                bottom: bottomPadding + 16,
                left: 0,
                right: 0,
                child: SlidingIndicator(
                  count: widget.photos.length,
                  currentIndex: _currentIndex,
                  onTap: (index) {
                    _pageController.animateToPage(
                      index,
                      duration: const Duration(milliseconds: 300),
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

/// 정보 바텀시트
class _InfoBottomSheet extends StatelessWidget {
  final LightboxPhoto photo;

  const _InfoBottomSheet({required this.photo});

  @override
  Widget build(BuildContext context) {
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    final rows = <Widget>[
      if (photo.members != null && photo.members!.isNotEmpty)
        _InfoRow(
          icon: LucideIcons.users,
          iconBackgroundColor: appPalette.primary.withValues(alpha: 0.2),
          iconColor: appPalette.primary,
          label: '멤버',
          value: photo.members!,
        ),
      if (photo.concept != null && photo.concept!.isNotEmpty)
        _InfoRow(
          icon: LucideIcons.tag,
          iconBackgroundColor: Colors.white.withValues(alpha: 0.1),
          iconColor: const Color(0xFFA1A1AA), // zinc-400
          label: '컨셉',
          value: photo.concept!,
        ),
      if (photo.albumTitle != null && photo.albumTitle!.isNotEmpty)
        _InfoRow(
          icon: LucideIcons.disc3,
          iconBackgroundColor: Colors.white.withValues(alpha: 0.1),
          iconColor: const Color(0xFFA1A1AA),
          label: '앨범',
          value: photo.albumTitle!,
        ),
    ];

    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF18181B), // zinc-900
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 드래그 핸들
          Container(
            margin: const EdgeInsets.only(top: 12, bottom: 8),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFF52525B), // zinc-600
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // 내용
          Padding(
            padding: EdgeInsets.fromLTRB(20, 8, 20, 32 + bottomPadding),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '사진 정보',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 16),
                for (var i = 0; i < rows.length; i++) ...[
                  if (i > 0) const SizedBox(height: 16),
                  rows[i],
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 정보 행 위젯
class _InfoRow extends StatelessWidget {
  final IconData icon;
  final Color iconBackgroundColor;
  final Color iconColor;
  final String label;
  final String value;

  const _InfoRow({
    required this.icon,
    required this.iconBackgroundColor,
    required this.iconColor,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: iconBackgroundColor,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 16, color: iconColor),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: Color(0xFFA1A1AA), // zinc-400
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(color: Colors.white, fontSize: 15),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// 슬라이딩 인디케이터 (공용)
class SlidingIndicator extends StatelessWidget {
  final int count;
  final int currentIndex;
  final Function(int) onTap;

  const SlidingIndicator({
    super.key,
    required this.count,
    required this.currentIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    const double width = 120;
    const double dotSpacing = 18;
    const double activeDotSize = 12;

    final double halfWidth = width / 2;
    final double translateX =
        -(currentIndex * dotSpacing) + halfWidth - (activeDotSize / 2);

    return Center(
      child: SizedBox(
        width: width,
        height: 20,
        child: ShaderMask(
          shaderCallback: (Rect bounds) {
            return const LinearGradient(
              colors: [
                Colors.transparent,
                Colors.white,
                Colors.white,
                Colors.transparent,
              ],
              stops: [0.0, 0.15, 0.85, 1.0],
            ).createShader(bounds);
          },
          blendMode: BlendMode.dstIn,
          child: Stack(
            children: [
              // 슬라이딩 점들
              AnimatedPositioned(
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeOutCubic,
                left: translateX,
                top: 0,
                bottom: 0,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: List.generate(count, (index) {
                    final isActive = index == currentIndex;
                    const inactiveDotSize = 10.0;
                    return GestureDetector(
                      onTap: () => onTap(index),
                      child: Container(
                        width: dotSpacing,
                        alignment: Alignment.center,
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          width: isActive ? activeDotSize : inactiveDotSize,
                          height: isActive ? activeDotSize : inactiveDotSize,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isActive
                                ? Colors.white
                                : Colors.white.withValues(alpha: 0.4),
                          ),
                        ),
                      ),
                    );
                  }),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
