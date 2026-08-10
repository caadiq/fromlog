/// 멤버 목록 — 에디토리얼 리뉴얼 (웹 pages/mobile/members/Members.jsx 대응)
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants.dart';
import '../../controllers/members_controller.dart';
import '../../widgets/editorial.dart';
import '../../widgets/e_motion.dart';

class MembersView extends ConsumerWidget {
  const MembersView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final membersState = ref.watch(membersProvider);

    if (membersState.isLoading && membersState.members.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(color: EColors.ink, strokeWidth: 2.5),
      );
    }

    if (membersState.members.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => ref.read(membersProvider.notifier).loadMembers(),
        color: EColors.ink,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            SizedBox(height: 200),
            Center(
              child: Text(
                '멤버 정보가 없습니다',
                style: TextStyle(fontSize: 13.5, color: EColors.mute),
              ),
            ),
          ],
        ),
      );
    }

    final activeMembers =
        membersState.members.where((m) => !m.isFormer).toList();

    return RefreshIndicator(
      onRefresh: () => ref.read(membersProvider.notifier).loadMembers(),
      color: EColors.ink,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 페이지 헤더 — MEM+BERS 아웃라인 타이틀
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(22, 30, 22, 24),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: EColors.hairline, width: 1)),
            ),
            child: const EFadeUp(
              child: OutlineTitle(
                solid: 'MEM',
                outline: 'BERS',
                fontSize: 46,
                letterSpacing: -2,
              ),
            ),
          ),

          // 멤버 리스트
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 6, 22, 32),
            child: Column(
              children: [
                for (var i = 0; i < activeMembers.length; i++)
                  EReveal(
                    delayMs: kStaggerMs * i,
                    child: InkWell(
                      onTap: () => context.push(
                        '/members/${(activeMembers[i].nameEn ?? '').toLowerCase()}',
                      ),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        decoration: const BoxDecoration(
                          border: Border(
                            bottom: BorderSide(color: EColors.hairline, width: 1),
                          ),
                        ),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 22,
                              child: Text(
                                (i + 1).toString().padLeft(2, '0'),
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                  color: EColors.faint,
                                ),
                              ),
                            ),
                            const SizedBox(width: 16),
                            ClipOval(
                              child: SizedBox(
                                width: 64,
                                height: 64,
                                child: activeMembers[i].imageThumb != null ||
                                        activeMembers[i].imageUrl != null
                                    ? CachedNetworkImage(
                                        imageUrl: activeMembers[i].imageThumb ??
                                            activeMembers[i].imageUrl!,
                                        fit: BoxFit.cover,
                                        placeholder: (context, url) =>
                                            Container(color: EColors.canvas),
                                      )
                                    : Container(color: EColors.canvas),
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    activeMembers[i].name,
                                    style: const TextStyle(
                                      fontSize: 17.5,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: -0.3,
                                      color: EColors.ink,
                                    ),
                                  ),
                                  Text(
                                    (activeMembers[i].nameEn ?? '').toUpperCase(),
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 2,
                                      color: EColors.mute,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    _formatBirth(activeMembers[i].birthDate),
                                    style: const TextStyle(
                                      fontSize: 13,
                                      color: EColors.esub,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Text(
                              '→',
                              style: TextStyle(fontSize: 16, color: EColors.faint),
                            ),
                          ],
                        ),
                      ),
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

/// 'YYYY-MM-DDT…' → 'YYYY. MM. DD'
String _formatBirth(String? birthDate) {
  if (birthDate == null || birthDate.length < 10) return '';
  return birthDate.substring(0, 10).replaceAll('-', '. ');
}
