/// 응원법 가사 한 줄.
///
/// 화면에서 떼어놓아 레이아웃을 따로 잴 수 있게 했다 — 줄마다 글자가
/// 같은 자리에서 시작해야 하는데, 눈으로는 몇 px 어긋난 것을 알기 어렵다.
library;

import 'package:flutter/material.dart';

import '../../core/constants.dart';
import '../../models/fanchant.dart';

/// 조각이 지금 어떤 상태인가
enum PieceState {
  /// 아직 오지 않음
  upcoming,

  /// 지금 이 자리
  now,

  /// 지나감
  passed,
}

class FanchantLineView extends StatelessWidget {
  final FanchantLine line;

  /// 조각 위치 → 상태
  final Map<int, PieceState> states;

  /// 배경이 들어갈 응원법 조각 위치 (없으면 null)
  final int? callPi;

  /// 왼쪽 세로 바
  final bool showBar;

  final Color callColor;
  final Color singColor;
  final void Function(double t)? onSeek;

  const FanchantLineView({
    super.key,
    required this.line,
    required this.states,
    required this.callColor,
    required this.singColor,
    this.callPi,
    this.showBar = false,
    this.onSeek,
  });

  /// 바 자리 — 모든 줄이 이만큼 들여쓴다 (바가 없어도 자리는 지킨다)
  static const double barWidth = 3;
  static const double barGap = 15;
  static const double fontSize = 15;

  /// 줄 높이에서 남는 공간을 위아래 **균등하게** 나눈다.
  ///
  /// Flutter 기본(proportional)은 폰트 메트릭 비율대로 나눠서, 굵기가 다르면
  /// 글자가 줄 안에서 위아래로 치우친다 — 응원법(w900)만 위로 붙어 보였다.
  /// CSS line-height는 원래 균등 분배라 이렇게 두면 웹과 같아진다.
  static const TextLeadingDistribution leading = TextLeadingDistribution.even;

  /// 응원법이 켜졌을 때 붙는 여백 (웹 px-2 py-0.5)
  static const EdgeInsets onPadding = EdgeInsets.symmetric(
    horizontal: 8,
    vertical: 2,
  );

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: barWidth,
            height: 21,
            margin: const EdgeInsets.only(top: 3, right: barGap),
            color: showBar ? callColor : Colors.transparent,
          ),
          // 조각을 위젯으로 늘어놓는다 — 응원법에 여백·테두리를 주려면 글자만으로는 안 된다.
          // 긴 응원법은 이 안에서 다시 접히므로 배경이 두 줄에 걸쳐 그려진다.
          Expanded(
            child: Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              runSpacing: 2,
              children: [
                for (var pi = 0; pi < line.parts.length; pi++) _part(pi),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _part(int pi) {
    final part = line.parts[pi];
    final state = states[pi] ?? PieceState.upcoming;
    final t = part.t ?? line.t;

    Widget tap(Widget child) => (t == null || onSeek == null)
        ? child
        : GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => onSeek!(t),
            child: child,
          );

    if (!part.isCall) {
      return tap(
        AnimatedDefaultTextStyle(
          duration: const Duration(milliseconds: 150),
          style: TextStyle(
            fontSize: fontSize,
            height: 1.75,
            leadingDistribution: leading,
            color: switch (state) {
              PieceState.now => EColors.ink,
              PieceState.passed => const Color(0xFFCFCFCF),
              PieceState.upcoming => const Color(0xFFB4B4B4),
            },
            fontWeight: state == PieceState.now
                ? FontWeight.w800
                : FontWeight.w600,
          ),
          child: Text(part.text),
        ),
      );
    }

    // 지금 외칠 응원법이면 배경·테두리가 들어온다 (웹과 같은 값)
    final on = callPi == pi;
    final color = part.type == 'sing' ? singColor : callColor;
    return tap(
      AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeOut,
        padding: on ? onPadding : EdgeInsets.zero,
        decoration: on
            ? BoxDecoration(
                color: color.withValues(alpha: 0.13),
                borderRadius: BorderRadius.circular(3),
                // 테두리를 border로 주면 1px이 자리를 차지해 글자가 그만큼 더 밀린다.
                // 웹은 boxShadow(0 0 0 1px)라 자리를 안 먹으므로 그림자로 흉내낸다
                boxShadow: [
                  BoxShadow(
                    color: color.withValues(alpha: 0.2),
                    spreadRadius: 1,
                    blurRadius: 0,
                  ),
                ],
              )
            : null,
        child: Text(
          part.text,
          style: TextStyle(
            fontSize: fontSize,
            height: 1.75,
            leadingDistribution: leading,
            fontWeight: FontWeight.w900,
            color: on
                ? color
                : color.withValues(
                    alpha: state == PieceState.passed ? 0.45 : 1.0,
                  ),
          ),
        ),
      ),
    );
  }
}
