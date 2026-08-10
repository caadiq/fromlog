/// 앨범 목록 — 에디토리얼 리뉴얼 (웹 pages/mobile/album/Album.jsx 대응)
/// 연도 타임라인 + 2열 그리드
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/constants.dart';
import '../../core/format_utils.dart';
import '../../models/album.dart';
import '../../controllers/album_controller.dart';
import '../../widgets/editorial.dart';
import '../../widgets/e_motion.dart';

/// 발매일 전체 표기: 2026. 7. 21.
String _fmtReleaseDate(String? s) {
  if (s == null || s.isEmpty) return '';
  final d = parseDate(s);
  if (d == null) return '';
  return '${d.year}. ${d.month}. ${d.day}.';
}

/// 타이틀곡
String _getTitleTrack(List<Track>? tracks) {
  if (tracks == null || tracks.isEmpty) return '';
  final t = tracks.where((x) => x.isTitleTrack == 1).firstOrNull;
  return (t ?? tracks.first).title;
}

class AlbumView extends ConsumerWidget {
  const AlbumView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final albumState = ref.watch(albumProvider);

    if (albumState.isLoading && albumState.albums.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(color: EColors.ink, strokeWidth: 2.5),
      );
    }

    if (albumState.error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              '앨범을 불러오는데 실패했습니다',
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
                color: EColors.mute,
              ),
            ),
            const SizedBox(height: 14),
            GestureDetector(
              onTap: () => ref.read(albumProvider.notifier).refresh(),
              child: Container(
                color: EColors.ink,
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 11,
                ),
                child: const Text(
                  '다시 시도',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    final albums = albumState.albums;

    // 연도별 그룹 (내림차순)
    final groups = <String, List<Album>>{};
    for (final a in albums) {
      final y = (a.releaseDate != null && a.releaseDate!.length >= 4)
          ? a.releaseDate!.substring(0, 4)
          : '기타';
      groups.putIfAbsent(y, () => []).add(a);
    }
    final years = groups.entries.toList()
      ..sort((a, b) => b.key.compareTo(a.key));

    return RefreshIndicator(
      onRefresh: () => ref.read(albumProvider.notifier).refresh(),
      color: EColors.ink,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
          // 페이지 헤더
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(22, 30, 22, 22),
            decoration: const BoxDecoration(
              border: Border(
                bottom: BorderSide(color: EColors.hairline, width: 1),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const EFadeUp(
                  child: OutlineTitle(
                    solid: 'DISCO',
                    outline: 'GRAPHY',
                    fontSize: 42,
                    letterSpacing: -2,
                  ),
                ),
                const SizedBox(height: 10),
                EFadeUp(
                  delayMs: kStaggerMs,
                  child: Text(
                    '${albums.length} ALBUMS',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1.5,
                      color: EColors.mute,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 연도 타임라인
          Padding(
            padding: const EdgeInsets.only(bottom: 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final entry in years) ...[
                  EReveal(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(22, 26, 22, 4),
                      child: Row(
                        children: [
                          Text(
                            entry.key,
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.5,
                              color: EColors.ink,
                            ),
                          ),
                          const SizedBox(width: 16),
                          const Expanded(child: Hairline()),
                          const SizedBox(width: 16),
                          Text(
                            '${entry.value.length} RELEASE${entry.value.length > 1 ? 'S' : ''}',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1.5,
                              color: EColors.mute,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(22, 12, 22, 16),
                    child: _YearGrid(albums: entry.value),
                  ),
                ],
              ],
            ),
          ),
        ],
        ),
      ),
    );
  }
}

/// 연도별 2열 그리드
class _YearGrid extends StatelessWidget {
  final List<Album> albums;

  const _YearGrid({required this.albums});

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < albums.length; i += 2) {
      rows.add(
        Padding(
          padding: EdgeInsets.only(top: i == 0 ? 0 : 24),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: EReveal(delayMs: 0, child: _AlbumCard(album: albums[i])),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: i + 1 < albums.length
                    ? EReveal(
                        delayMs: kStaggerMs,
                        child: _AlbumCard(album: albums[i + 1]),
                      )
                    : const SizedBox.shrink(),
              ),
            ],
          ),
        ),
      );
    }
    return Column(children: rows);
  }
}

/// 앨범 카드 — 커버 + 상단 잉크 룰 + 제목/타이틀곡/타입
class _AlbumCard extends StatelessWidget {
  final Album album;

  const _AlbumCard({required this.album});

  @override
  Widget build(BuildContext context) {
    final cover =
        album.coverMediumUrl ?? album.coverThumbUrl ?? album.coverOriginalUrl;
    final titleTrack = _getTitleTrack(album.tracks);
    final type = (album.albumTypeShort ?? album.albumType ?? '').toUpperCase();
    final releaseDate = _fmtReleaseDate(album.releaseDate);

    return GestureDetector(
      onTap: () => context.push('/album/${album.folderName}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: cover != null
                ? CachedNetworkImage(
                    imageUrl: cover,
                    fit: BoxFit.cover,
                    placeholder: (context, url) =>
                        Container(color: EColors.canvas),
                  )
                : Container(
                    color: EColors.canvasDeep,
                    alignment: Alignment.center,
                    child: const Text(
                      '◉',
                      style: TextStyle(fontSize: 34, color: EColors.faint),
                    ),
                  ),
          ),
          Container(
            width: double.infinity,
            margin: const EdgeInsets.only(top: 8),
            padding: const EdgeInsets.only(top: 8),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: EColors.ink, width: 2)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  album.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                    color: EColors.ink,
                  ),
                ),
                if (titleTrack.isNotEmpty)
                  Text(
                    titleTrack,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: appPalette.primary,
                    ),
                  ),
                Text(
                  '$type · $releaseDate',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                    color: EColors.mute,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
