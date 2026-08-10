/// 곡 상세 — 에디토리얼 리뉴얼 (웹 pages/mobile/album/TrackDetail.jsx 대응)
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:omni_video_player/omni_video_player.dart';
import '../../core/constants.dart';
import '../../models/album.dart';
import '../../services/albums_service.dart';
import '../../widgets/e_motion.dart';

class TrackDetailView extends StatefulWidget {
  final String albumName;
  final String trackTitle;

  const TrackDetailView({
    super.key,
    required this.albumName,
    required this.trackTitle,
  });

  @override
  State<TrackDetailView> createState() => _TrackDetailViewState();
}

class _TrackDetailViewState extends State<TrackDetailView> {
  late Future<TrackDetail> _trackFuture;
  bool _lyricsOpen = false;

  @override
  void initState() {
    super.initState();
    _trackFuture = getTrack(widget.albumName, widget.trackTitle);
  }

  /// YouTube URL에서 비디오 ID 추출
  String? _getYoutubeVideoId(String? url) {
    if (url == null) return null;
    final regex = RegExp(
      r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)',
    );
    final match = regex.firstMatch(url);
    return match?.group(1);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EColors.paper,
      body: SafeArea(
        child: FutureBuilder<TrackDetail>(
          future: _trackFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(
                child: CircularProgressIndicator(color: EColors.ink, strokeWidth: 2.5),
              );
            }
            if (snapshot.hasError || !snapshot.hasData) {
              return const Center(
                child: Text(
                  '곡을 찾을 수 없습니다',
                  style: TextStyle(fontSize: 13.5, color: EColors.mute),
                ),
              );
            }

            final track = snapshot.data!;
            final album = track.album;
            final videoId = _getYoutubeVideoId(track.musicVideoUrl);
            final videoLabel =
                track.videoType == 'special' ? 'SPECIAL VIDEO' : 'OFFICIAL MV';

            final credits = <(String, String)>[
              if (track.lyricist != null && track.lyricist!.isNotEmpty)
                ('작사', track.lyricist!),
              if (track.composer != null && track.composer!.isNotEmpty)
                ('작곡', track.composer!),
              if (track.arranger != null && track.arranger!.isNotEmpty)
                ('편곡', track.arranger!),
            ];

            final lyricsLines = (track.lyrics ?? '').split('\n');
            final lyricsLong = lyricsLines.length > 10;
            final lyricsPreview = lyricsLines.take(10).join('\n');

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
                        icon: const Icon(LucideIcons.chevronLeft,
                            size: 22, color: EColors.esub),
                      ),
                      Expanded(
                        child: Text(
                          '${(album?.title ?? '').toUpperCase()} / TRACK ${track.trackNumber.toString().padLeft(2, '0')}',
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
                        // 히어로 — 워터마크 번호 + TITLE 배지 + 곡명
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.fromLTRB(22, 30, 22, 26),
                          decoration: const BoxDecoration(
                            border: Border(
                                bottom: BorderSide(color: EColors.hairline, width: 1)),
                          ),
                          child: Stack(
                            clipBehavior: Clip.none,
                            children: [
                              // 워터마크 트랙 번호
                              Positioned(
                                right: 0,
                                top: -8,
                                child: Text(
                                  track.trackNumber.toString().padLeft(2, '0'),
                                  style: TextStyle(
                                    fontSize: 64,
                                    fontWeight: FontWeight.w900,
                                    height: 1.0,
                                    letterSpacing: -3,
                                    foreground: Paint()
                                      ..style = PaintingStyle.stroke
                                      ..strokeWidth = 1.5
                                      ..color = const Color(0xFFE2E4DC),
                                  ),
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  SizedBox(
                                    height: 20,
                                    child: track.isTitleTrack == 1
                                        ? EFadeUp(
                                            child: Container(
                                              padding: const EdgeInsets.symmetric(
                                                  horizontal: 8, vertical: 3),
                                              decoration: BoxDecoration(
                                                color: appPalette.primary,
                                                borderRadius: BorderRadius.circular(3),
                                              ),
                                              child: const Text(
                                                'TITLE',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w800,
                                                  letterSpacing: 1.5,
                                                  color: Colors.white,
                                                ),
                                              ),
                                            ),
                                          )
                                        : null,
                                  ),
                                  const SizedBox(height: 10),
                                  EFadeUp(
                                    delayMs: kStaggerMs,
                                    child: Text(
                                      track.title,
                                      style: const TextStyle(
                                        fontSize: 40,
                                        fontWeight: FontWeight.w900,
                                        height: 1.02,
                                        letterSpacing: -1.8,
                                        color: EColors.ink,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  EFadeUp(
                                    delayMs: kStaggerMs * 2,
                                    child: GestureDetector(
                                      onTap: album?.folderName != null
                                          ? () => context.pop()
                                          : null,
                                      child: Text.rich(
                                        TextSpan(
                                          children: [
                                            TextSpan(
                                              text: album?.title ?? '',
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w700,
                                                color: EColors.ink,
                                              ),
                                            ),
                                            TextSpan(
                                              text:
                                                  ' · ${album?.albumType ?? ''}${track.duration != null ? ' · ${track.duration}' : ''}',
                                            ),
                                          ],
                                        ),
                                        style: const TextStyle(
                                          fontSize: 14,
                                          color: EColors.esub,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),

                        // MV 임베드
                        if (videoId != null)
                          Container(
                            decoration: const BoxDecoration(
                              border: Border(
                                  bottom: BorderSide(color: EColors.hairline, width: 1)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                AspectRatio(
                                  aspectRatio: 16 / 9,
                                  child: Container(
                                    color: EColors.ink,
                                    child: OmniVideoPlayer(
                                      configuration: VideoPlayerConfiguration(
                                        videoSourceConfiguration:
                                            VideoSourceConfiguration.youtube(
                                          videoUrl: Uri.parse(
                                            'https://www.youtube.com/watch?v=$videoId',
                                          ),
                                          preferredQualities: [
                                            OmniVideoQuality.high720,
                                          ],
                                        ),
                                      ),
                                      callbacks: const VideoPlayerCallbacks(),
                                    ),
                                  ),
                                ),
                                Padding(
                                  padding:
                                      const EdgeInsets.symmetric(horizontal: 22, vertical: 10),
                                  child: Text(
                                    '$videoLabel — YOUTUBE',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 2,
                                      color: EColors.mute,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),

                        Padding(
                          padding: const EdgeInsets.fromLTRB(22, 24, 22, 56),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // CREDITS
                              if (credits.isNotEmpty) ...[
                                EReveal(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const _SectionRule(label: 'CREDITS'),
                                      for (final c in credits)
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 2, vertical: 11),
                                          decoration: const BoxDecoration(
                                            border: Border(
                                                bottom: BorderSide(
                                                    color: EColors.hairline, width: 1)),
                                          ),
                                          child: Row(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              SizedBox(
                                                width: 64,
                                                child: Text(
                                                  c.$1,
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
                                                  c.$2,
                                                  style: const TextStyle(
                                                    fontSize: 14,
                                                    fontWeight: FontWeight.w600,
                                                    height: 1.6,
                                                    color: EColors.ink,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 26),
                              ],

                              // LYRICS
                              EReveal(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const _SectionRule(label: 'LYRICS'),
                                    if (track.lyrics != null &&
                                        track.lyrics!.isNotEmpty) ...[
                                      Text(
                                        _lyricsOpen || !lyricsLong
                                            ? track.lyrics!
                                            : '$lyricsPreview\n⋯',
                                        style: const TextStyle(
                                          fontSize: 15,
                                          height: 2.1,
                                          color: EColors.ebody,
                                        ),
                                      ),
                                      if (lyricsLong)
                                        Padding(
                                          padding: const EdgeInsets.only(top: 16),
                                          child: GestureDetector(
                                            onTap: () => setState(
                                                () => _lyricsOpen = !_lyricsOpen),
                                            child: Text(
                                              _lyricsOpen ? '가사 접기 ↑' : '전체 가사 펼치기 ↓',
                                              style:  TextStyle(
                                                fontSize: 12.5,
                                                fontWeight: FontWeight.w800,
                                                letterSpacing: 2,
                                                color: appPalette.primary,
                                              ),
                                            ),
                                          ),
                                        ),
                                    ] else
                                      const Padding(
                                        padding: EdgeInsets.symmetric(vertical: 32),
                                        child: Text(
                                          '가사 정보가 없습니다',
                                          style: TextStyle(
                                              fontSize: 14.5, color: EColors.mute),
                                        ),
                                      ),
                                  ],
                                ),
                              ),

                              // IN THIS ALBUM
                              if (track.otherTracks.isNotEmpty) ...[
                                const SizedBox(height: 32),
                                EReveal(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const _SectionRule(label: 'IN THIS ALBUM'),
                                      for (final t in track.otherTracks)
                                        _OtherTrackRow(
                                          track: t,
                                          current: t.id == track.id,
                                          onTap: t.id == track.id
                                              ? null
                                              : () => context.pushReplacement(
                                                    '/album/${widget.albumName}/track/${Uri.encodeComponent(t.title)}',
                                                  ),
                                        ),
                                    ],
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
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

/// 섹션 라벨 — 상단 2px 잉크 룰
class _SectionRule extends StatelessWidget {
  final String label;

  const _SectionRule({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: EColors.ink, width: 2)),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w800,
          letterSpacing: 3,
          color: EColors.ink,
        ),
      ),
    );
  }
}

/// IN THIS ALBUM 행
class _OtherTrackRow extends StatelessWidget {
  final Track track;
  final bool current;
  final VoidCallback? onTap;

  const _OtherTrackRow({required this.track, required this.current, this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 12),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: EColors.hairline, width: 1)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            SizedBox(
              width: 24,
              child: Text(
                track.trackNumber.toString().padLeft(2, '0'),
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: current ? appPalette.primary : EColors.faint,
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Row(
                children: [
                  Flexible(
                    child: Text(
                      track.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: current ? FontWeight.w800 : FontWeight.w600,
                        color: current ? EColors.ink : EColors.esub,
                      ),
                    ),
                  ),
                  if (track.isTitleTrack == 1) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
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
              track.duration ?? '',
              style: TextStyle(
                fontSize: 13,
                color: current ? EColors.ink : EColors.faint,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
