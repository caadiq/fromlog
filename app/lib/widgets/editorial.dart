/// 에디토리얼 리뉴얼 공용 위젯 (웹 components/editorial/index.jsx 대응)
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/constants.dart';
import '../core/format_utils.dart';

/// 워드마크식 제목 — 앞부분 솔리드 잉크 + 뒷부분 그린 아웃라인
/// (웹 OutlineTitle: WebkitTextStroke 2px #548360)
class OutlineTitle extends StatelessWidget {
  final String solid;
  final String outline;
  final double fontSize;
  final double letterSpacing;
  final double strokeWidth;
  final Color solidColor;

  /// null이면 현재 테마 primary 사용 (런타임 동적 색)
  final Color? strokeColor;

  const OutlineTitle({
    super.key,
    required this.solid,
    required this.outline,
    required this.fontSize,
    this.letterSpacing = 0,
    this.strokeWidth = 2,
    this.solidColor = EColors.ink,
    this.strokeColor,
  });

  @override
  Widget build(BuildContext context) {
    final base = TextStyle(
      fontFamily: 'Pretendard',
      fontSize: fontSize,
      fontWeight: FontWeight.w900,
      height: 1.0,
      letterSpacing: letterSpacing,
    );
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: solid, style: base.copyWith(color: solidColor)),
          TextSpan(
            text: outline,
            style: base.copyWith(
              foreground: Paint()
                ..style = PaintingStyle.stroke
                ..strokeWidth = strokeWidth
                ..color = strokeColor ?? appPalette.primary,
            ),
          ),
        ],
      ),
    );
  }
}

/// 섹션 헤더 — 레터스페이싱 라벨 + (선택) 전체보기 액션
/// (웹 모바일 홈 SecHeader: px22 pt26 pb14)
class SecHeader extends StatelessWidget {
  final String label;
  final String? to;
  final String actionText;

  const SecHeader({super.key, required this.label, this.to, this.actionText = '전체보기 →'});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(22, 26, 22, 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 2.5,
              color: EColors.ink,
            ),
          ),
          const Spacer(),
          if (to != null)
            GestureDetector(
              // 전체보기는 바텀네비 탭 루트로 이동 — go로 탭 전환처럼 동작시켜
              // (push는 홈을 스택에 남겨 이후 홈 재진입 시 애니메이션/스크롤 초기화가 안 됨)
              onTap: () => context.go(to!),
              child: Text(
                actionText,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                  color: appPalette.primary,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// 카테고리 라벨 — 카테고리 색 텍스트 (웹 CategoryLabel mobile)
class CategoryLabelText extends StatelessWidget {
  final String? name;
  final String? colorHex;

  const CategoryLabelText({super.key, this.name, this.colorHex});

  @override
  Widget build(BuildContext context) {
    if (name == null) return const SizedBox.shrink();
    return Text(
      name!,
      maxLines: 1,
      style: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.3,
        color: parseColor(colorHex, fallback: EColors.esub),
      ),
    );
  }
}

/// 헤어라인 구분선
class Hairline extends StatelessWidget {
  final double thickness;
  final Color color;

  const Hairline({super.key, this.thickness = 1, this.color = EColors.hairline});

  @override
  Widget build(BuildContext context) {
    return Container(height: thickness, color: color);
  }
}

/// 점선 divider — 4px 대시 + 3px 간격(주기 7px), 높이 1, faintLight.
/// 일정·홈 등에서 공용으로 쓴다. 폭에 맞춰 대시 개수를 자동 계산.
class DashedLine extends StatelessWidget {
  const DashedLine({super.key});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) {
        final count = (c.maxWidth / 7).floor();
        return Row(
          children: List.generate(
            count,
            (_) => Container(
              width: 4,
              height: 1,
              margin: const EdgeInsets.only(right: 3),
              color: EColors.faintLight,
            ),
          ),
        );
      },
    );
  }
}


/// 2열 masonry 그리드 — 누적 높이가 낮은 열에 배치 (웹 MasonryGallery와 동일)
class EMasonryGrid<T> extends StatelessWidget {
  final List<T> items;
  final double gap;

  /// height/width 비율 (세로/가로)
  final double Function(T item) ratioOf;
  final Widget Function(BuildContext context, T item, int index) itemBuilder;

  const EMasonryGrid({
    super.key,
    required this.items,
    required this.ratioOf,
    required this.itemBuilder,
    this.gap = 10,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final colWidth = (constraints.maxWidth - gap) / 2;
        final columns = [<(int, T)>[], <(int, T)>[]];
        final heights = [0.0, 0.0];

        for (var i = 0; i < items.length; i++) {
          final ratio = ratioOf(items[i]);
          final col = heights[0] <= heights[1] ? 0 : 1;
          columns[col].add((i, items[i]));
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
                    for (final (index, item) in columns[c])
                      Padding(
                        padding: EdgeInsets.only(bottom: gap),
                        child: itemBuilder(context, item, index),
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
