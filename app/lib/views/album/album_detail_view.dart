/// 앨범 상세 — 에디토리얼 리뉴얼 (웹 pages/mobile/album/AlbumDetail.jsx 대응)
library;

import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants.dart';
import '../../models/album.dart';
import '../../services/albums_service.dart';
import '../../widgets/e_motion.dart';
import '../../widgets/photo_lightbox.dart';
import '../../widgets/teaser_viewer.dart';

class AlbumDetailView extends StatefulWidget {
  final String albumName;

  const AlbumDetailView({super.key, required this.albumName});

  @override
  State<AlbumDetailView> createState() => _AlbumDetailViewState();
}

class _AlbumDetailViewState extends State<AlbumDetailView> {
  late Future<Album> _albumFuture;

  @override
  void initState() {
    super.initState();
    _albumFuture = getAlbumByName(widget.albumName);
  }

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
              return Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      '앨범을 찾을 수 없습니다',
                      style: TextStyle(fontSize: 13.5, color: EColors.mute),
                    ),
                    const SizedBox(height: 14),
                    GestureDetector(
                      onTap: () => context.pop(),
                      child: Container(
                        color: EColors.ink,
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
                        child: const Text(
                          '돌아가기',
                          style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1,
                              color: Colors.white),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }
            return _Body(album: snapshot.data!);
          },
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  final Album album;

  const _Body({required this.album});

  /// 앨범 소개 시트 (웹 ABOUT 시트와 동일 문법)
  void _showDescription(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.75,
        ),
        decoration: const BoxDecoration(
          color: EColors.paper,
          border: Border(top: BorderSide(color: EColors.ink, width: 1)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: EColors.hairline, width: 1)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'ABOUT — ${album.title}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 2.5,
                        color: EColors.ink,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: const Padding(
                      padding: EdgeInsets.all(4),
                      child: Icon(LucideIcons.x, size: 17, color: EColors.mute),
                    ),
                  ),
                ],
              ),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 30),
                child: SizedBox(
                  width: double.infinity,
                  child: Text(
                    album.description ?? '',
                    style: const TextStyle(
                      fontSize: 14.5,
                      height: 1.75,
                      color: EColors.ebody,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tracks = album.tracks ?? [];
    final titleTrack = tracks.where((t) => t.isTitleTrack == 1).firstOrNull;
    final teasers = album.teasers ?? [];
    final conceptPhotos = album.allConceptPhotos;
    final cover = album.coverMediumUrl ?? album.coverOriginalUrl;
    final totalDuration = album.totalDuration;
    final hasMv = titleTrack?.videoUrl != null && titleTrack!.videoUrl!.isNotEmpty;
    final hasDescription = album.description != null && album.description!.isNotEmpty;

    return Column(
      children: [
        // 크럼 바
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: EColors.hairline, width: 1)),
          ),
          child: Row(
            children: [
              IconButton(
                onPressed: () => context.pop(),
                icon: const Icon(LucideIcons.chevronLeft, size: 22, color: EColors.esub),
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

        Expanded(
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 커버 — 전폭
                TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: 1),
                  duration: const Duration(milliseconds: 700),
                  curve: Curves.easeOut,
                  builder: (context, v, child) => Opacity(opacity: v, child: child),
                  child: Container(
                    decoration: const BoxDecoration(
                      border: Border(bottom: BorderSide(color: EColors.hairline, width: 1)),
                    ),
                    child: cover != null
                        ? GestureDetector(
                            onTap: () => showPhotoLightbox(
                              context,
                              [
                                LightboxPhoto(
                                  mediumUrl: album.coverOriginalUrl ?? cover,
                                  originalUrl: album.coverOriginalUrl,
                                ),
                              ],
                              0,
                              heroPrefix: 'album_cover',
                            ),
                            child: AspectRatio(
                              aspectRatio: 1,
                              child: CachedNetworkImage(
                                imageUrl: cover,
                                fit: BoxFit.cover,
                                placeholder: (context, url) => Container(color: EColors.canvas),
                              ),
                            ),
                          )
                        : Container(
                            height: 320,
                            color: EColors.canvasDeep,
                            alignment: Alignment.center,
                            child: const Text('◉',
                                style: TextStyle(fontSize: 44, color: EColors.faint)),
                          ),
                  ),
                ),

                // 정보 — 타입 + 제목 + 팩트 시트
                Padding(
                  padding: const EdgeInsets.fromLTRB(22, 26, 22, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      EFadeUp(
                        child: Text(
                          album.albumType ?? '',
                          style:  TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 2.5,
                            color: appPalette.primary,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      EFadeUp(
                        delayMs: kStaggerMs,
                        child: Text(
                          album.title,
                          style: const TextStyle(
                            fontSize: 38,
                            fontWeight: FontWeight.w900,
                            height: 1.05,
                            letterSpacing: -1.5,
                            color: EColors.ink,
                          ),
                        ),
                      ),
                      const SizedBox(height: 22),
                      EFadeUp(
                        delayMs: kStaggerMs * 2,
                        child: Container(
                          decoration: const BoxDecoration(
                            border: Border(top: BorderSide(color: EColors.ink, width: 2)),
                          ),
                          child: Column(
                            children: [
                              _FactRow(
                                label: 'RELEASE',
                                value: (album.releaseDate ?? '')
                                    .split('T')[0]
                                    .replaceAll('-', '. '),
                              ),
                              if (titleTrack != null)
                                _FactRow(label: 'TITLE TRACK', value: titleTrack.title),
                              if (tracks.isNotEmpty)
                                _FactRow(
                                  label: 'TRACKS',
                                  value:
                                      '${tracks.length}곡${totalDuration.isNotEmpty ? ' · $totalDuration' : ''}',
                                ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // 버튼 — 뮤직비디오 / 앨범 소개
                if (hasMv || hasDescription)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(22, 18, 22, 6),
                    child: Row(
                      children: [
                        if (hasMv)
                          Expanded(
                            child: GestureDetector(
                              onTap: () => launchUrl(
                                Uri.parse(titleTrack.videoUrl!),
                                mode: LaunchMode.externalApplication,
                              ),
                              child: Container(
                                color: EColors.ink,
                                padding: const EdgeInsets.symmetric(vertical: 13),
                                alignment: Alignment.center,
                                child: const Text(
                                  '▶ 뮤직비디오',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 1.5,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        if (hasMv && hasDescription) const SizedBox(width: 10),
                        if (hasDescription)
                          Expanded(
                            child: GestureDetector(
                              onTap: () => _showDescription(context),
                              child: Container(
                                decoration: BoxDecoration(
                                  border: Border.all(color: EColors.ink),
                                ),
                                padding: const EdgeInsets.symmetric(vertical: 13),
                                alignment: Alignment.center,
                                child: const Text(
                                  '앨범 소개',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 1.5,
                                    color: EColors.ink,
                                  ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),

                // TRACKLIST
                if (tracks.isNotEmpty) ...[
                  EReveal(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(22, 28, 22, 12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          const Text(
                            'TRACKLIST',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 3,
                              color: EColors.ink,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            '${tracks.length}곡',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: EColors.mute,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  EReveal(
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 22),
                      decoration: const BoxDecoration(
                        border: Border(top: BorderSide(color: EColors.ink, width: 2)),
                      ),
                      child: Column(
                        children: [
                          for (final t in tracks)
                            InkWell(
                              onTap: () => context.push(
                                '/album/${album.folderName}/track/${Uri.encodeComponent(t.title)}',
                              ),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 14),
                                decoration: const BoxDecoration(
                                  border: Border(
                                      bottom: BorderSide(color: EColors.hairline, width: 1)),
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.baseline,
                                  textBaseline: TextBaseline.alphabetic,
                                  children: [
                                    SizedBox(
                                      width: 24,
                                      child: Text(
                                        t.trackNumber.toString().padLeft(2, '0'),
                                        style: const TextStyle(
                                          fontSize: 13.5,
                                          fontWeight: FontWeight.w800,
                                          color: EColors.faint,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Row(
                                        children: [
                                          Flexible(
                                            child: Text(
                                              t.title,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                fontSize: 15.5,
                                                fontWeight: FontWeight.w700,
                                                letterSpacing: -0.2,
                                                color: EColors.ink,
                                              ),
                                            ),
                                          ),
                                          if (t.isTitleTrack == 1) ...[
                                            const SizedBox(width: 8),
                                            Container(
                                              padding: const EdgeInsets.symmetric(
                                                  horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: appPalette.primary,
                                                borderRadius: BorderRadius.circular(3),
                                              ),
                                              child: const Text(
                                                'TITLE',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w800,
                                                  letterSpacing: 1,
                                                  color: Colors.white,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Text(
                                      t.duration ?? '',
                                      style: const TextStyle(
                                        fontSize: 13.5,
                                        color: EColors.mute,
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
                ],

                // TEASERS
                if (teasers.isNotEmpty) ...[
                  const EReveal(
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(22, 28, 22, 12),
                      child: Text(
                        'TEASERS',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 3,
                          color: EColors.ink,
                        ),
                      ),
                    ),
                  ),
                  EReveal(
                    child: SizedBox(
                      height: 110,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: 22),
                        itemCount: teasers.length,
                        separatorBuilder: (context, index) => const SizedBox(width: 8),
                        itemBuilder: (context, i) {
                          final t = teasers[i];
                          return GestureDetector(
                            onTap: () => showTeaserViewer(context, teasers, i),
                            child: SizedBox(
                              width: 110,
                              child: Stack(
                                fit: StackFit.expand,
                                children: [
                                  CachedNetworkImage(
                                    imageUrl: t.thumbUrl ?? t.originalUrl ?? '',
                                    fit: BoxFit.cover,
                                    placeholder: (context, url) =>
                                        Container(color: EColors.canvas),
                                  ),
                                  if (t.mediaType == 'video')
                                    Container(
                                      color: Colors.black.withValues(alpha: 0.3),
                                      alignment: Alignment.center,
                                      child: Container(
                                        width: 32,
                                        height: 32,
                                        decoration: BoxDecoration(
                                          color: Colors.white.withValues(alpha: 0.9),
                                          shape: BoxShape.circle,
                                        ),
                                        alignment: Alignment.center,
                                        child: const Text(
                                          '▶',
                                          style: TextStyle(fontSize: 13, color: EColors.ink),
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                ],

                // CONCEPT PHOTOS
                if (conceptPhotos.isNotEmpty) ...[
                  const EReveal(
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(22, 28, 22, 12),
                      child: Text(
                        'CONCEPT PHOTOS',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 3,
                          color: EColors.ink,
                        ),
                      ),
                    ),
                  ),
                  EReveal(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(22, 0, 22, 56),
                      child: Row(
                        children: [
                          for (var i = 0; i < conceptPhotos.length && i < 3; i++) ...[
                            if (i > 0) const SizedBox(width: 8),
                            Expanded(
                              child: GestureDetector(
                                onTap: () => showPhotoLightbox(
                                  context,
                                  conceptPhotos
                                      .take(3)
                                      .map((p) => LightboxPhoto(
                                            mediumUrl: p.mediumUrl ?? p.thumbUrl,
                                            originalUrl: p.originalUrl,
                                            members: p.members,
                                            concept: p.concept,
                                          ))
                                      .toList(),
                                  i,
                                  heroPrefix: 'album_concept_preview',
                                ),
                                child: AspectRatio(
                                  aspectRatio: 0.8,
                                  child: CachedNetworkImage(
                                    imageUrl: conceptPhotos[i].mediumUrl ??
                                        conceptPhotos[i].thumbUrl ??
                                        '',
                                    fit: BoxFit.cover,
                                    placeholder: (context, url) =>
                                        Container(color: EColors.canvas),
                                  ),
                                ),
                              ),
                            ),
                          ],
                          if (conceptPhotos.length > 3) ...[
                            const SizedBox(width: 8),
                            Expanded(
                              child: GestureDetector(
                                onTap: () =>
                                    context.push('/album/${album.folderName}/gallery'),
                                child: AspectRatio(
                                  aspectRatio: 0.8,
                                  child: Container(
                                    decoration: BoxDecoration(
                                      border: Border.all(color: EColors.hairline),
                                    ),
                                    child: Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Text(
                                          '+${conceptPhotos.length - 3}',
                                          style: const TextStyle(
                                            fontSize: 16.5,
                                            fontWeight: FontWeight.w900,
                                            color: EColors.ink,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        const Text(
                                          '전체보기',
                                          style: TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w700,
                                            letterSpacing: 0.5,
                                            color: EColors.esub,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
                if (conceptPhotos.isEmpty) const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// 팩트 시트 행 — 라벨 104px + 값
class _FactRow extends StatelessWidget {
  final String label;
  final String value;

  const _FactRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: EColors.hairline, width: 1)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          SizedBox(
            width: 104,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                letterSpacing: 2,
                color: EColors.mute,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: EColors.ink,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
