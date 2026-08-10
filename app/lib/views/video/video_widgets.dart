/// 영상 공용 위젯 — 카드·썸네일 (웹 pages/mobile/video/Video.jsx 대응)
library;

import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants.dart';
import '../../core/format_utils.dart';
import '../../models/video.dart';

/// 카테고리 표시 라벨 (웹 CATEGORY_META — 순서 포함)
const List<({String key, String ko})> kVideoCategories = [
  (key: 'official', ko: '본채널'),
  (key: 'sp', ko: '스프'),
  (key: 'variety', ko: '예능 · 기타'),
  (key: 'music', ko: '무대 · 퍼포먼스'),
];

String videoCategoryKo(String key) {
  for (final c in kVideoCategories) {
    if (c.key == key) return c.ko;
  }
  return '전체';
}

/// 'YYYY-MM-DD …' → 'M. D.' (올해가 아니면 'Y. M. D.') — 웹 fmtShortDate
String fmtVideoDate(String publishedAt) {
  if (publishedAt.length < 10) return '';
  final parts = publishedAt.substring(0, 10).split('-');
  final y = int.tryParse(parts[0]) ?? 0;
  final m = int.tryParse(parts[1]) ?? 0;
  final d = int.tryParse(parts[2]) ?? 0;
  return y != DateTime.now().year ? '$y. $m. $d.' : '$m. $d.';
}

Future<void> openVideo(VideoItem v) async {
  await launchUrl(Uri.parse(v.url), mode: LaunchMode.externalApplication);
}

/// 썸네일 우하단 길이 배지 (웹 VideoDuration 대응)
///
/// 쇼츠에는 붙이지 않는다 — 전부 3분 이하라 길이가 정보가 되지 못한다.
/// 길이를 못 받은 영상(라이브 스트림 등)은 아무것도 그리지 않는다.
class VideoDurationBadge extends StatelessWidget {
  final int? seconds;
  final String videoType;

  const VideoDurationBadge({
    super.key,
    required this.seconds,
    required this.videoType,
  });

  @override
  Widget build(BuildContext context) {
    if (videoType == 'shorts') return const SizedBox.shrink();
    final label = formatVideoDuration(seconds);
    if (label.isEmpty) return const SizedBox.shrink();

    return Positioned(
      right: 6,
      bottom: 6,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        // 앱은 썸네일이 작아 배지가 화면을 더 가린다 — 모바일 웹과 같은 65%
        color: EColors.ink.withValues(alpha: 0.65),
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            height: 1,
            letterSpacing: 0.2,
            color: Colors.white,
            fontFeatures: [FontFeature.tabularFigures()],
          ),
        ),
      ),
    );
  }
}

/// 일반 영상 카드 (16:9) — 웹 MobileVideoCard
class VideoCard extends StatelessWidget {
  final VideoItem video;
  final bool showChannel;

  const VideoCard({super.key, required this.video, this.showChannel = true});

  @override
  Widget build(BuildContext context) {
    final sub = [
      if (showChannel && (video.channelName?.isNotEmpty ?? false)) video.channelName!,
      fmtVideoDate(video.publishedAt),
    ].join(' · ');

    return GestureDetector(
      onTap: () => openVideo(video),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              AspectRatio(
                aspectRatio: 16 / 9,
                child: CachedNetworkImage(
                  imageUrl: 'https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg',
                  fit: BoxFit.cover,
                  placeholder: (_, _) => Container(color: EColors.hairline),
                  errorWidget: (_, _, _) => Container(color: EColors.hairline),
                ),
              ),
              VideoDurationBadge(seconds: video.duration, videoType: video.videoType),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            video.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w800,
              height: 1.4,
              letterSpacing: -0.2,
              color: EColors.ink,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            sub,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: EColors.mute,
            ),
          ),
        ],
      ),
    );
  }
}

/// 쇼츠 썸네일 — oardefault(9:16)가 없으면 404 대신 120×90 회색 플레이스홀더가
/// 오므로(웹과 동일한 함정) 로드된 이미지 크기로 판별해 hqdefault로 교체한다.
class ShortsThumb extends StatefulWidget {
  final String videoId;

  const ShortsThumb({super.key, required this.videoId});

  @override
  State<ShortsThumb> createState() => _ShortsThumbState();
}

class _ShortsThumbState extends State<ShortsThumb> {
  bool _fallback = false;

  @override
  Widget build(BuildContext context) {
    final url = _fallback
        ? 'https://img.youtube.com/vi/${widget.videoId}/hqdefault.jpg'
        : 'https://img.youtube.com/vi/${widget.videoId}/oardefault.jpg';

    return AspectRatio(
      aspectRatio: 9 / 16,
      child: CachedNetworkImage(
        imageUrl: url,
        fit: BoxFit.cover,
        placeholder: (_, _) => Container(color: EColors.hairline),
        errorWidget: (_, _, _) {
          if (!_fallback) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) setState(() => _fallback = true);
            });
          }
          return Container(color: EColors.hairline);
        },
        imageBuilder: (context, provider) {
          if (!_fallback) {
            // 플레이스홀더(120×90) 판별 — 실제 oardefault는 405×720
            provider.resolve(ImageConfiguration.empty).addListener(
              ImageStreamListener((info, _) {
                if (info.image.width <= 120 && mounted && !_fallback) {
                  setState(() => _fallback = true);
                }
              }),
            );
          }
          return Image(image: provider, fit: BoxFit.cover);
        },
      ),
    );
  }
}

/// 쇼츠 세로 카드 — 웹 MobileShortsCard
class ShortsCard extends StatelessWidget {
  final VideoItem video;

  const ShortsCard({super.key, required this.video});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => openVideo(video),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ShortsThumb(videoId: video.videoId),
          const SizedBox(height: 6),
          Text(
            video.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              height: 1.35,
              letterSpacing: -0.2,
              color: EColors.ink,
            ),
          ),
        ],
      ),
    );
  }
}

/// 피처드 썸네일 — maxres → sd → hq 순 폴백 (웹과 동일)
class FeaturedThumb extends StatefulWidget {
  final String videoId;

  const FeaturedThumb({super.key, required this.videoId});

  @override
  State<FeaturedThumb> createState() => _FeaturedThumbState();
}

class _FeaturedThumbState extends State<FeaturedThumb> {
  static const _variants = ['maxresdefault', 'sddefault', 'hqdefault'];
  int _idx = 0;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: CachedNetworkImage(
        imageUrl:
            'https://img.youtube.com/vi/${widget.videoId}/${_variants[_idx]}.jpg',
        fit: BoxFit.cover,
        placeholder: (_, _) => Container(color: EColors.hairline),
        errorWidget: (_, _, _) {
          if (_idx < _variants.length - 1) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) setState(() => _idx++);
            });
          }
          return Container(color: EColors.hairline);
        },
        imageBuilder: (context, provider) {
          if (_idx == 0) {
            // maxresdefault도 404 대신 120×90 플레이스홀더가 오는 경우가 있다
            provider.resolve(ImageConfiguration.empty).addListener(
              ImageStreamListener((info, _) {
                if (info.image.width <= 120 && mounted && _idx < _variants.length - 1) {
                  setState(() => _idx++);
                }
              }),
            );
          }
          return Image(image: provider, fit: BoxFit.cover);
        },
      ),
    );
  }
}
