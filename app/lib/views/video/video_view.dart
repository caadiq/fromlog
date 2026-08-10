/// 영상 메인 — 에디토리얼 (웹 pages/mobile/video/Video.jsx 대응)
/// 피처드 + 카테고리 섹션(2열) + SHORTS 가로 레일
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants.dart';
import '../../models/video.dart';
import '../../controllers/videos_controller.dart';
import '../../widgets/editorial.dart';
import '../../widgets/e_motion.dart';
import 'video_widgets.dart';

class VideoView extends ConsumerWidget {
  const VideoView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(videosProvider);

    if (state.isLoading && state.data == null) {
      return const Center(
        child: CircularProgressIndicator(color: EColors.ink, strokeWidth: 2.5),
      );
    }

    if (state.error != null && state.data == null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(state.error!,
                style: const TextStyle(fontSize: 13.5, color: EColors.mute)),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => ref.read(videosProvider.notifier).load(),
              child: const Text('다시 시도',
                  style: TextStyle(color: EColors.ink, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      );
    }

    final data = state.data!;
    final featured = data.featured;

    return RefreshIndicator(
      color: EColors.ink,
      onRefresh: () => ref.read(videosProvider.notifier).load(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(22, 26, 22, 64),
        children: [
          // 타이틀 (웹: ARCHIVE / VIDEOS)
          const EFadeUp(
            child: Text('ARCHIVE',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 2,
                    color: EColors.mute)),
          ),
          const SizedBox(height: 4),
          const EFadeUp(
            delayMs: kStaggerMs,
            // PC·모바일 웹과 동일한 아웃라인 포인트 (VIDE + OS)
            child: OutlineTitle(
              solid: 'VIDE',
              outline: 'OS',
              fontSize: 32,
              letterSpacing: -1.2,
              strokeWidth: 1.6,
            ),
          ),

          // 피처드
          if (featured != null) ...[
            const SizedBox(height: 20),
            EFadeUp(
              delayMs: kStaggerMs * 2,
              child: GestureDetector(
                onTap: () => openVideo(featured),
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: EColors.hairline),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // 플레이 아이콘 없음 — 썸네일 중앙을 가려서 웹과 함께 제거
                      Stack(
                        children: [
                          FeaturedThumb(videoId: featured.videoId),
                          VideoDurationBadge(
                            seconds: featured.duration,
                            videoType: featured.videoType,
                          ),
                        ],
                      ),
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'LATEST${(featured.channelName?.isNotEmpty ?? false) ? ' · ${featured.channelName!.toUpperCase()}' : ''}',
                              style: TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 2,
                                  color: appPalette.primary),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              featured.title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  height: 1.4,
                                  letterSpacing: -0.3,
                                  color: EColors.ink),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              featured.publishedAt.length >= 10
                                  ? '${featured.publishedAt.substring(0, 10).replaceAll('-', '. ')}.'
                                  : '',
                              style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: EColors.mute),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],

          // 카테고리 섹션 (2열)
          for (final cat in kVideoCategories)
            if ((data.sections[cat.key] ?? []).isNotEmpty)
              _CategorySection(
                categoryKey: cat.key,
                label: data.labels[cat.key] ?? cat.ko,
                count: data.counts[cat.key],
                videos: data.sections[cat.key]!,
              ),

          // SHORTS — 가로 레일
          if (data.shorts.isNotEmpty) ...[
            const SizedBox(height: 36),
            EReveal(
              child: _SectionHeader(
                label: 'SHORTS',
                count: data.counts['shorts'],
                onMore: () => context.push('/video/shorts'),
              ),
            ),
            // 화면 밖까지 밀리는 레일 — 단, 스크롤 처음·끝 멈춤 위치는
            // 섹션 보더(22px)와 정렬된다 (Clip.none + 패딩 경계)
            EReveal(
              child: SizedBox(
                height: 124 / 9 * 16 + 6 + 34,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: EdgeInsets.zero,
                  clipBehavior: Clip.none,
                  itemCount: data.shorts.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 12),
                  itemBuilder: (context, i) => SizedBox(
                    width: 124,
                    child: ShortsCard(video: data.shorts[i]),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// 섹션 헤더 — 상단 잉크 보더 + 라벨·카운트 + 전체보기
class _SectionHeader extends StatelessWidget {
  final String label;
  final int? count;
  final VoidCallback onMore;

  const _SectionHeader({required this.label, this.count, required this.onMore});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: EColors.ink, width: 2)),
      ),
      padding: const EdgeInsets.only(top: 12, bottom: 14),
      child: Row(
        children: [
          // 라벨+카운트를 하나의 Expanded로 묶는다 — Flexible과 Spacer를 나란히 두면
          // 남는 공간을 반씩 나눠 가져 '전체보기'가 오른쪽 끝에 붙지 않는다
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.3,
                        color: EColors.ink),
                  ),
                ),
                if (count != null) ...[
                  const SizedBox(width: 6),
                  Text('$count',
                      style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: EColors.mute)),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          GestureDetector(
            onTap: onMore,
            child: Text('전체보기 →',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                    color: appPalette.primary)),
          ),
        ],
      ),
    );
  }
}

/// 카테고리 섹션 — 헤더 + 2열 그리드 (최대 4개)
class _CategorySection extends StatelessWidget {
  final String categoryKey;
  final String label;
  final int? count;
  final List<VideoItem> videos;

  const _CategorySection({
    required this.categoryKey,
    required this.label,
    this.count,
    required this.videos,
  });

  @override
  Widget build(BuildContext context) {
    final showChannel = categoryKey == 'music' || categoryKey == 'variety';
    final items = videos.take(4).toList();

    return Padding(
      padding: const EdgeInsets.only(top: 36),
      child: Column(
        children: [
          EReveal(
            child: _SectionHeader(
              label: label,
              count: count,
              onMore: () => context.push('/video/$categoryKey'),
            ),
          ),
          EReveal(
            child: LayoutBuilder(builder: (context, constraints) {
              final w = (constraints.maxWidth - 12) / 2;
              return Wrap(
                spacing: 12,
                runSpacing: 20,
                children: [
                  for (final v in items)
                    SizedBox(
                      width: w,
                      child: VideoCard(video: v, showChannel: showChannel),
                    ),
                ],
              );
            }),
          ),
        ],
      ),
    );
  }
}
