/// 멤버 갤러리 — 멤버 포함 컨셉 포토 전체 (웹 pages/mobile/members/MemberPhotos.jsx 대응)
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/constants.dart';
import '../../models/member.dart';
import '../../controllers/members_controller.dart';
import '../../services/members_service.dart';
import '../../widgets/photo_lightbox.dart';

const _typeLabels = {'group': '단체', 'unit': '유닛', 'solo': '개인'};

/// 멤버 전체 포토 Provider
final memberAllPhotosProvider =
    FutureProvider.family<List<MemberPhoto>, String>((ref, nameEn) {
  return getMemberAllPhotos(nameEn);
});

class MemberPhotosView extends ConsumerStatefulWidget {
  final String nameEn;

  const MemberPhotosView({super.key, required this.nameEn});

  @override
  ConsumerState<MemberPhotosView> createState() => _MemberPhotosViewState();
}

class _MemberPhotosViewState extends ConsumerState<MemberPhotosView> {
  String _filter = 'all';

  @override
  Widget build(BuildContext context) {
    final membersState = ref.watch(membersProvider);
    final member = membersState.members
        .where((m) =>
            (m.nameEn ?? '').toLowerCase() == widget.nameEn.toLowerCase())
        .firstOrNull;
    final photosAsync =
        ref.watch(memberAllPhotosProvider(member?.nameEn ?? widget.nameEn));
    final photos = photosAsync.asData?.value ?? [];

    final typeCounts = <String, int>{};
    for (final p in photos) {
      typeCounts[p.photoType] = (typeCounts[p.photoType] ?? 0) + 1;
    }
    final filtered = _filter == 'all'
        ? photos
        : photos.where((p) => p.photoType == _filter).toList();

    return Scaffold(
      backgroundColor: EColors.paper,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 크럼 바 + 타이틀
            Container(
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: EColors.hairline, width: 1)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 4, 12, 0),
                    child: Row(
                      children: [
                        IconButton(
                          onPressed: () => context.pop(),
                          icon: const Icon(LucideIcons.chevronLeft,
                              size: 22, color: EColors.esub),
                        ),
                        Text(
                          'MEMBERS / ${member?.name ?? ''}',
                          style: const TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 2.5,
                            color: EColors.mute,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(22, 8, 22, 20),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text(
                          'PHOTOS',
                          style: TextStyle(
                            fontSize: 34,
                            fontWeight: FontWeight.w900,
                            height: 1.0,
                            letterSpacing: -1.5,
                            color: EColors.ink,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          '${photos.length} PHOTOS',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 1.5,
                            color: EColors.mute,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // 타입 필터
            Container(
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: EColors.hairline, width: 1)),
              ),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
                child: Row(
                  children: [
                    _FilterChip(
                      label: '전체 ${photos.length}',
                      active: _filter == 'all',
                      onTap: () => setState(() => _filter = 'all'),
                    ),
                    for (final t in ['group', 'unit', 'solo'])
                      if ((typeCounts[t] ?? 0) > 0) ...[
                        const SizedBox(width: 8),
                        _FilterChip(
                          label: '${_typeLabels[t]} ${typeCounts[t]}',
                          active: _filter == t,
                          onTap: () => setState(() => _filter = t),
                        ),
                      ],
                  ],
                ),
              ),
            ),

            // 2열 masonry
            Expanded(
              child: photosAsync.isLoading
                  ? const Center(
                      child: CircularProgressIndicator(
                          color: EColors.ink, strokeWidth: 2.5),
                    )
                  : SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(10, 14, 10, 56),
                      child: _MasonryGrid(
                        photos: filtered,
                        gap: 10,
                        onTap: (index) => showPhotoLightbox(
                          context,
                          filtered
                              .map((p) => LightboxPhoto(
                                    mediumUrl: p.mediumUrl ?? p.thumbUrl,
                                    concept: p.conceptName,
                                    albumTitle: p.albumTitle,
                                  ))
                              .toList(),
                          index,
                          heroPrefix: 'member_gallery',
                        ),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 필터 칩 — 잉크 활성 (웹과 동일)
class _FilterChip extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _FilterChip({required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: active ? EColors.ink : Colors.transparent,
          border: Border.all(color: active ? EColors.ink : EColors.hairline),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w800,
            letterSpacing: 1,
            color: active ? Colors.white : EColors.esub,
          ),
        ),
      ),
    );
  }
}

/// 2열 masonry 그리드 — 누적 높이가 낮은 열에 배치 (웹 MasonryGallery와 동일)
class _MasonryGrid extends StatelessWidget {
  final List<MemberPhoto> photos;
  final double gap;
  final void Function(int index) onTap;

  const _MasonryGrid({required this.photos, required this.gap, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final colWidth = (constraints.maxWidth - gap) / 2;
        final columns = [<(int, MemberPhoto)>[], <(int, MemberPhoto)>[]];
        final heights = [0.0, 0.0];

        for (var i = 0; i < photos.length; i++) {
          final p = photos[i];
          final ratio = (p.width != null && p.height != null && p.width! > 0)
              ? p.height! / p.width!
              : 1.25;
          final col = heights[0] <= heights[1] ? 0 : 1;
          columns[col].add((i, p));
          heights[col] += colWidth * ratio + gap;
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var c = 0; c < 2; c++) ...[
              if (c > 0) SizedBox(width: gap),
              Expanded(
                child: Column(
                  children: [
                    for (final (index, p) in columns[c])
                      Padding(
                        padding: EdgeInsets.only(bottom: gap),
                        child: GestureDetector(
                          onTap: () => onTap(index),
                          child: AspectRatio(
                            aspectRatio:
                                (p.width != null && p.height != null && p.height! > 0)
                                    ? p.width! / p.height!
                                    : 0.8,
                            child: CachedNetworkImage(
                              imageUrl: p.thumbUrl ?? p.mediumUrl ?? '',
                              fit: BoxFit.cover,
                              placeholder: (context, url) =>
                                  Container(color: EColors.canvas),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}
