/// 생일/데뷔 축하 다이얼로그 + 폭죽 (웹 BirthdayCelebrationDialog·
/// DebutCelebrationDialog·fireConfetti와 동일한 연출)
library;

import 'dart:math';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:confetti/confetti.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/constants.dart';
import '../models/schedule.dart';
import 'fromis9_logo.dart';

/// 생일 축하 (폭죽 + 다이얼로그)
Future<void> showBirthdayCelebration(BuildContext context, Schedule schedule) {
  return _showCelebration(
    context,
    confettiColors: const [
      Color(0xFFFF69B4),
      Color(0xFFFF1493),
      Color(0xFFDA70D6),
      Color(0xFFBA55D3),
      Color(0xFF9370DB),
      Color(0xFF8A2BE2),
      Color(0xFFFFD700),
      Color(0xFFFF6347),
    ],
    builder: (context) => _CelebrationCard(
      eyebrow: 'BIRTHDAY',
      circle: schedule.memberImage != null
          ? ClipOval(
              child: CachedNetworkImage(
                imageUrl: schedule.memberImage!,
                width: 112,
                height: 112,
                fit: BoxFit.cover,
              ),
            )
          : null,
      title: schedule.title,
      subtitle: () {
        final d = DateTime.parse(schedule.date);
        return '${d.month}. ${d.day}.';
      }(),
    ),
  );
}

/// 데뷔/주년 축하 (폭죽 + 다이얼로그)
Future<void> showDebutCelebration(BuildContext context, Schedule schedule) {
  final year = schedule.anniversaryYear ?? 0;
  return _showCelebration(
    context,
    confettiColors: const [
      Color(0xFF7A99C8),
      Color(0xFF98B0D8),
      Color(0xFFB8C8E8),
      Colors.white,
      Color(0xFFFFD700),
      Color(0xFFC0C0C0),
    ],
    builder: (context) => _CelebrationCard(
      eyebrow: schedule.isDebut ? 'DEBUT' : 'ANNIVERSARY',
      circle: schedule.isDebut
          ? const Fromis9Logo(size: 52, color: EColors.ink)
          : Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '$year',
                  style: const TextStyle(
                    fontSize: 40,
                    fontWeight: FontWeight.w900,
                    color: EColors.ink,
                    height: 1,
                  ),
                ),
                const Text(
                  'YEARS',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.5,
                    color: EColors.mute,
                  ),
                ),
              ],
            ),
      title: schedule.isDebut ? '프로미스나인 데뷔' : '프로미스나인 데뷔 $year주년',
      subtitle: '2018. 01. 24',
    ),
  );
}

Future<void> _showCelebration(
  BuildContext context, {
  required List<Color> confettiColors,
  required WidgetBuilder builder,
}) {
  return showGeneralDialog(
    context: context,
    barrierDismissible: true,
    barrierLabel: '닫기',
    barrierColor: Colors.black.withValues(alpha: 0.5),
    transitionDuration: const Duration(milliseconds: 250),
    pageBuilder: (context, animation, secondaryAnimation) {
      return _CelebrationOverlay(
        confettiColors: confettiColors,
        child: builder(context),
      );
    },
    transitionBuilder: (context, animation, secondaryAnimation, child) {
      // 웹: scale 0.8→1 + y 20→0 스프링
      final curved = CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutBack,
      );
      return FadeTransition(
        opacity: animation,
        child: Transform.translate(
          offset: Offset(0, 20 * (1 - animation.value)),
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.8, end: 1).animate(curved),
            child: child,
          ),
        ),
      );
    },
  );
}

/// 폭죽 오버레이 (화면 좌/우 상단에서 3초간 발사 — 웹 confetti와 동일 연출)
class _CelebrationOverlay extends StatefulWidget {
  final List<Color> confettiColors;
  final Widget child;

  const _CelebrationOverlay({
    required this.confettiColors,
    required this.child,
  });

  @override
  State<_CelebrationOverlay> createState() => _CelebrationOverlayState();
}

class _CelebrationOverlayState extends State<_CelebrationOverlay> {
  late final ConfettiController _left;
  late final ConfettiController _right;

  @override
  void initState() {
    super.initState();
    _left = ConfettiController(duration: const Duration(seconds: 3))..play();
    _right = ConfettiController(duration: const Duration(seconds: 3))..play();
  }

  @override
  void dispose() {
    _left.dispose();
    _right.dispose();
    super.dispose();
  }

  Widget _cannon(ConfettiController controller, double direction) {
    return ConfettiWidget(
      confettiController: controller,
      blastDirection: direction,
      emissionFrequency: 0.18,
      numberOfParticles: 10,
      maxBlastForce: 22,
      minBlastForce: 8,
      gravity: 0.25,
      particleDrag: 0.06,
      colors: widget.confettiColors,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Center(child: widget.child),
        // 좌상단 → 오른쪽 아래로
        Align(
          alignment: const Alignment(-0.7, -0.8),
          child: _cannon(_left, pi / 4),
        ),
        // 우상단 → 왼쪽 아래로
        Align(
          alignment: const Alignment(0.7, -0.8),
          child: _cannon(_right, 3 * pi / 4),
        ),
      ],
    );
  }
}

/// 축하 카드 — 에디토리얼 (페이퍼·잉크·헤어라인 + primary 이어브로우)
class _CelebrationCard extends StatelessWidget {
  final String eyebrow;
  final Widget? circle;
  final String title;
  final String subtitle;

  const _CelebrationCard({
    required this.eyebrow,
    required this.circle,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 40),
        constraints: const BoxConstraints(maxWidth: 360),
        decoration: BoxDecoration(
          color: EColors.paper,
          border: Border.all(color: EColors.hairline),
          boxShadow: [
            BoxShadow(
              color: EColors.ink.withValues(alpha: 0.35),
              blurRadius: 60,
              offset: const Offset(0, 24),
            ),
          ],
        ),
        child: Stack(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(32, 44, 32, 40),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    eyebrow,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 2.5,
                      color: appPalette.primary,
                    ),
                  ),
                  const SizedBox(height: 20),
                  Container(
                    width: 112,
                    height: 112,
                    clipBehavior: Clip.antiAlias,
                    decoration: BoxDecoration(
                      color: EColors.canvasDeep,
                      shape: BoxShape.circle,
                      border: Border.all(color: EColors.hairline),
                    ),
                    child: Center(child: circle ?? const SizedBox.shrink()),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    title,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      height: 1.3,
                      letterSpacing: -0.6,
                      color: EColors.ink,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1,
                      color: EColors.mute,
                    ),
                  ),
                ],
              ),
            ),
            // 닫기 버튼
            Positioned(
              top: 12,
              right: 12,
              child: GestureDetector(
                onTap: () => Navigator.of(context).pop(),
                child: const Padding(
                  padding: EdgeInsets.all(6),
                  child: Icon(LucideIcons.x, size: 18, color: EColors.mute),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
