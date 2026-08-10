/// 멤버 상세 — 에디토리얼 신설 (웹 pages/mobile/members/MemberDetail.jsx 대응)
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants.dart';
import '../../models/member.dart';
import '../../controllers/members_controller.dart';
import '../../services/members_service.dart';
import '../../widgets/e_motion.dart';
import '../../widgets/photo_lightbox.dart';

/// 멤버 최근 포토 3장 Provider
final memberPhotosProvider =
    FutureProvider.family<List<MemberPhoto>, String>((ref, nameEn) {
  return getMemberPhotos(nameEn, limit: 3);
});

/// 다음 생일까지 D-day + 날짜
({String dday, String date})? _nextBirthday(String? birthDate) {
  if (birthDate == null || birthDate.length < 10) return null;
  final parts = birthDate.substring(0, 10).split('-').map(int.parse).toList();
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  var next = DateTime(today.year, parts[1], parts[2]);
  if (next.isBefore(today)) next = DateTime(today.year + 1, parts[1], parts[2]);
  final diff = next.difference(today).inDays;
  const weekdays = ['월', '화', '수', '목', '금', '토', '일'];
  final w = weekdays[next.weekday - 1];
  final mm = '${parts[1]}'.padLeft(2, '0');
  final dd = '${parts[2]}'.padLeft(2, '0');
  return (
    dday: diff == 0 ? 'D-DAY' : 'D-$diff',
    date: '${next.year}. $mm. $dd ($w)',
  );
}

class MemberDetailView extends ConsumerWidget {
  final String nameEn;

  const MemberDetailView({super.key, required this.nameEn});

  Future<void> _openInstagram(String url) async {
    final uri = Uri.tryParse(url);
    final username = (uri != null && uri.pathSegments.isNotEmpty)
        ? uri.pathSegments.first
        : null;
    if (username != null) {
      final deepLink = Uri.parse('instagram://user?username=$username');
      if (await canLaunchUrl(deepLink)) {
        await launchUrl(deepLink);
        return;
      }
    }
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final membersState = ref.watch(membersProvider);
    final activeMembers =
        membersState.members.where((m) => !m.isFormer).toList();
    final member = membersState.members
        .where((m) => (m.nameEn ?? '').toLowerCase() == nameEn.toLowerCase())
        .firstOrNull;
    final memberIndex =
        member == null ? -1 : activeMembers.indexWhere((m) => m.id == member.id);

    return Scaffold(
      backgroundColor: EColors.paper,
      body: SafeArea(
        child: membersState.isLoading
            ? const Center(
                child: CircularProgressIndicator(color: EColors.ink, strokeWidth: 2.5),
              )
            : member == null
                ? const Center(
                    child: Text(
                      '멤버를 찾을 수 없습니다',
                      style: TextStyle(fontSize: 13.5, color: EColors.mute),
                    ),
                  )
                : _Body(member: member, memberIndex: memberIndex, onInstagram: _openInstagram),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  final Member member;
  final int memberIndex;
  final Future<void> Function(String) onInstagram;

  const _Body({required this.member, required this.memberIndex, required this.onInstagram});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final photos =
        ref.watch(memberPhotosProvider(member.nameEn ?? '')).asData?.value ?? [];
    final bday = _nextBirthday(member.birthDate);
    final instaId = member.instagram != null
        ? member.instagram!.replaceAll(RegExp(r'/$'), '').split('/').last
        : null;

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
              Text(
                'MEMBERS${memberIndex >= 0 ? ' / ${(memberIndex + 1).toString().padLeft(2, '0')}' : ''}',
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

        Expanded(
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 대형 사진
                if (member.imageMedium != null || member.imageUrl != null)
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0, end: 1),
                    duration: const Duration(milliseconds: 700),
                    curve: Curves.easeOut,
                    builder: (context, v, child) => Opacity(opacity: v, child: child),
                    child: AspectRatio(
                      aspectRatio: 0.82,
                      child: CachedNetworkImage(
                        imageUrl: member.imageMedium ?? member.imageUrl!,
                        fit: BoxFit.cover,
                        placeholder: (context, url) => Container(color: EColors.canvas),
                      ),
                    ),
                  ),

                // 이름 + 팩트
                Padding(
                  padding: const EdgeInsets.fromLTRB(22, 26, 22, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      EFadeUp(
                        child: Text(
                          member.name,
                          style: const TextStyle(
                            fontSize: 44,
                            fontWeight: FontWeight.w900,
                            height: 1.0,
                            letterSpacing: -2,
                            color: EColors.ink,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      EFadeUp(
                        delayMs: kStaggerMs,
                        child: Text(
                          (member.nameEn ?? '').toUpperCase(),
                          style:  TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 4,
                            color: appPalette.primary,
                          ),
                        ),
                      ),
                      const SizedBox(height: 26),
                      EFadeUp(
                        delayMs: kStaggerMs * 2,
                        child: Container(
                          decoration: const BoxDecoration(
                            border: Border(top: BorderSide(color: EColors.ink, width: 2)),
                          ),
                          child: Column(
                            children: [
                              _FactRow(
                                label: 'BIRTH',
                                child: Text(
                                  member.birthDate != null
                                      ? member.birthDate!
                                          .substring(0, 10)
                                          .replaceAll('-', '. ')
                                      : '',
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
                                    color: EColors.ink,
                                  ),
                                ),
                              ),
                              if (instaId != null)
                                _FactRow(
                                  label: 'SNS',
                                  child: GestureDetector(
                                    onTap: () => onInstagram(member.instagram!),
                                    child: Container(
                                      decoration:  BoxDecoration(
                                        border: Border(
                                          bottom: BorderSide(color: appPalette.primary, width: 1.5),
                                        ),
                                      ),
                                      child: Text(
                                        '@$instaId',
                                        style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w600,
                                          color: EColors.ink,
                                        ),
                                      ),
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

                // 생일 D-day 카드
                if (bday != null)
                  EReveal(
                    child: Container(
                      margin: const EdgeInsets.fromLTRB(22, 10, 22, 20),
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        border: Border.all(color: EColors.hairline),
                      ),
                      child: Row(
                        children: [
                          Text(
                            bday.dday,
                            style:  TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w900,
                              color: appPalette.primary,
                            ),
                          ),
                          const SizedBox(width: 15),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                '다음 생일까지',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: EColors.ink,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                bday.date,
                                style: const TextStyle(fontSize: 12.5, color: EColors.mute),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),

                // RECENT PHOTOS
                if (photos.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(22, 16, 22, 40),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        EReveal(
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              const Text(
                                'RECENT PHOTOS',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 3,
                                  color: EColors.ink,
                                ),
                              ),
                              const Spacer(),
                              GestureDetector(
                                onTap: () => context.push(
                                  '/members/${(member.nameEn ?? '').toLowerCase()}/photos',
                                ),
                                child:  Text(
                                  '더보기 →',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: appPalette.primary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            for (var i = 0; i < photos.length; i++) ...[
                              if (i > 0) const SizedBox(width: 10),
                              Expanded(
                                child: EReveal(
                                  delayMs: kStaggerMs * i,
                                  child: GestureDetector(
                                    onTap: () => showPhotoLightbox(
                                      context,
                                      photos
                                          .map((p) => LightboxPhoto(
                                                mediumUrl: p.mediumUrl ?? p.thumbUrl,
                                                concept: p.conceptName,
                                                albumTitle: p.albumTitle,
                                              ))
                                          .toList(),
                                      i,
                                      heroPrefix: 'member_recent',
                                    ),
                                    child: AspectRatio(
                                      aspectRatio: 0.8,
                                      child: CachedNetworkImage(
                                        imageUrl: photos[i].mediumUrl ??
                                            photos[i].thumbUrl ??
                                            '',
                                        fit: BoxFit.cover,
                                        placeholder: (context, url) =>
                                            Container(color: EColors.canvas),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// 팩트 시트 행 — 라벨 100px + 값
class _FactRow extends StatelessWidget {
  final String label;
  final Widget child;

  const _FactRow({required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 13),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: EColors.hairline, width: 1)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          SizedBox(
            width: 100,
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
          child,
        ],
      ),
    );
  }
}
