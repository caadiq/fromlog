/// 앨범 컨셉포토 갤러리 — 에디토리얼 리뉴얼 (웹 pages/mobile/album/AlbumGallery.jsx 대응)
/// 컨셉/타입 필터 + 2열 masonry
library;

import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/constants.dart';
import '../../models/album.dart';
import '../../services/albums_service.dart';
import '../../widgets/editorial.dart';
import '../../widgets/photo_lightbox.dart';

const _typeLabels = {'group': '단체', 'unit': '유닛', 'solo': '개인'};

/// 필터 상태
sealed class _Filter {
  const _Filter();
}

class _FilterAll extends _Filter {
  const _FilterAll();
}

class _FilterConcept extends _Filter {
  final String concept;
  const _FilterConcept(this.concept);
}

class _FilterType extends _Filter {
  final String type;
  const _FilterType(this.type);
}

class AlbumGalleryView extends StatefulWidget {
  final String albumName;

  const AlbumGalleryView({super.key, required this.albumName});

  @override
  State<AlbumGalleryView> createState() => _AlbumGalleryViewState();
}

class _AlbumGalleryViewState extends State<AlbumGalleryView> {
  late Future<Album> _albumFuture;
  _Filter _filter = const _FilterAll();

  @override
  void initState() {
    super.initState();
    _albumFuture = getAlbumByName(widget.albumName);
  }

  bool _isRealConcept(String? c) => c != null && c.toLowerCase() != 'default';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EColors.paper,
      body: SafeArea(
        child: FutureBuilder<Album>(
          future: _albumFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(
                child: CircularProgressIndicator(color: EColors.ink, strokeWidth: 2.5),
              );
            }
            if (snapshot.hasError || !snapshot.hasData) {
              return const Center(
                child: Text(
                  '앨범을 찾을 수 없습니다',
                  style: TextStyle(fontSize: 13.5, color: EColors.mute),
                ),
              );
            }

            final album = snapshot.data!;
            final photos = album.allConceptPhotos;
            final concepts = (album.conceptPhotos?.keys ?? const <String>[])
                .where(_isRealConcept)
                .toList();

            final typeCounts = <String, int>{};
            for (final p in photos) {
              if (p.type != null) {
                typeCounts[p.type!] = (typeCounts[p.type!] ?? 0) + 1;
              }
            }

            final filtered = switch (_filter) {
              _FilterAll() => photos,
              _FilterConcept(concept: final c) =>
                photos.where((p) => p.concept == c).toList(),
              _FilterType(type: final t) =>
                photos.where((p) => p.type == t).toList(),
            };

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 크럼 + 타이틀
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
                            Expanded(
                              child: Text(
                                'DISCOGRAPHY / ${album.title}',
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
                      const Padding(
                        padding: EdgeInsets.fromLTRB(22, 6, 22, 18),
                        child: Text(
                          'CONCEPT PHOTOS',
                          style: TextStyle(
                            fontSize: 30,
                            fontWeight: FontWeight.w900,
                            height: 1.0,
                            letterSpacing: -1.2,
                            color: EColors.ink,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // 필터: 컨셉 + 타입
                Container(
                  decoration: const BoxDecoration(
                    border: Border(bottom: BorderSide(color: EColors.hairline, width: 1)),
                  ),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
                    child: Row(
                      children: [
                        _Chip(
                          label: 'ALL ${photos.length}',
                          active: _filter is _FilterAll,
                          onTap: () => setState(() => _filter = const _FilterAll()),
                        ),
                        for (final c in concepts) ...[
                          const SizedBox(width: 6),
                          _Chip(
                            label: c.toUpperCase(),
                            active: _filter is _FilterConcept &&
                                (_filter as _FilterConcept).concept == c,
                            onTap: () => setState(() => _filter = _FilterConcept(c)),
                          ),
                        ],
                        for (final t in ['group', 'unit', 'solo'])
                          if ((typeCounts[t] ?? 0) > 0) ...[
                            const SizedBox(width: 6),
                            _Chip(
                              label: '${_typeLabels[t]} ${typeCounts[t]}',
                              active: _filter is _FilterType &&
                                  (_filter as _FilterType).type == t,
                              onTap: () => setState(() => _filter = _FilterType(t)),
                            ),
                          ],
                      ],
                    ),
                  ),
                ),

                // 2열 masonry
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(10, 14, 10, 56),
                    child: EMasonryGrid<ConceptPhoto>(
                      items: filtered,
                      gap: 10,
                      ratioOf: (p) => p.aspectRatio,
                      itemBuilder: (context, p, index) => GestureDetector(
                        onTap: () => showPhotoLightbox(
                          context,
                          filtered
                              .map((x) => LightboxPhoto(
                                    mediumUrl: x.mediumUrl ?? x.thumbUrl,
                                    originalUrl: x.originalUrl,
                                    members: x.members,
                                    concept:
                                        _isRealConcept(x.concept) ? x.concept : null,
                                  ))
                              .toList(),
                          index,
                          heroPrefix: 'album_gallery',
                        ),
                        child: AspectRatio(
                          aspectRatio: 1 / p.aspectRatio,
                          child: CachedNetworkImage(
                            imageUrl: p.thumbUrl ?? p.mediumUrl ?? '',
                            fit: BoxFit.cover,
                            placeholder: (context, url) => Container(color: EColors.canvas),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// 필터 칩 — 잉크 활성 (웹과 동일)
class _Chip extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _Chip({required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
        decoration: BoxDecoration(
          color: active ? EColors.ink : Colors.transparent,
          border: Border.all(color: active ? EColors.ink : EColors.hairline),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            letterSpacing: 1,
            color: active ? Colors.white : EColors.esub,
          ),
        ),
      ),
    );
  }
}
