/// 일정 고정 링크 패널 — 헤더 확성기 버튼으로 펼친다 (웹 모바일과 1:1)
///
/// 항목 구성은 [마감 배지] 제목 ↗ 로 고정한다.
/// 유형 아이콘은 쓰지 않는다 — 기기마다 글리프가 달라 깨져 보이는 것이 있었다.
library;

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/constants.dart';
import '../../../models/schedule_link.dart';

/// 마감 배지 (종료일 없으면 아무것도 안 그림)
class _Deadline extends StatelessWidget {
  final String? label;
  const _Deadline({this.label});

  @override
  Widget build(BuildContext context) {
    if (label == null) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(right: 10),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      color: const Color(0xFFFBF6E4),
      child: Text(
        label!,
        style: const TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w800,
          color: Color(0xFF8A6D1B),
        ),
      ),
    );
  }
}

class ScheduleLinkPanel extends StatelessWidget {
  final List<ScheduleLink> links;

  const ScheduleLinkPanel({super.key, required this.links});

  Future<void> _open(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    if (links.isEmpty) return const SizedBox.shrink();

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.only(top: 6, bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 6),
            child: Row(
              children: [
                // 헤더 확성기 버튼과 같은 아이콘 (웹과 동일)
                const Icon(
                  LucideIcons.megaphone,
                  size: 13,
                  color: EColors.mute,
                ),
                const SizedBox(width: 8),
                Text(
                  '브라우저로 열립니다',
                  style: TextStyle(fontSize: 11, color: EColors.faint),
                ),
              ],
            ),
          ),
          for (final link in links)
            InkWell(
              onTap: () => _open(link.url),
              child: Container(
                decoration: const BoxDecoration(
                  border: Border(
                    top: BorderSide(color: EColors.hairline, width: 1),
                  ),
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 11,
                ),
                child: Row(
                  children: [
                    _Deadline(label: link.deadlineLabel),
                    Expanded(
                      child: Text(
                        link.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: EColors.ink,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Icon(
                      LucideIcons.externalLink,
                      size: 13,
                      color: EColors.faint.withValues(alpha: 0.9),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
