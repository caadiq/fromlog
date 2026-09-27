import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

/// Two-column photo layout with lazy children and stable source indices.
class MasonryScrollView<T> extends StatelessWidget {
  const MasonryScrollView({
    super.key,
    required this.items,
    required this.ratioOf,
    required this.itemBuilder,
    this.gap = 10,
  });
  final List<T> items;
  final double Function(T) ratioOf;
  final Widget Function(BuildContext, T, int) itemBuilder;
  final double gap;

  @override
  Widget build(BuildContext context) => GridView.builder(
    padding: const EdgeInsets.fromLTRB(10, 14, 10, 56),
    gridDelegate: _MasonryDelegate(items.map(ratioOf).toList(), gap),
    itemCount: items.length,
    itemBuilder: (context, index) => itemBuilder(context, items[index], index),
  );
}

class _MasonryDelegate extends SliverGridDelegate {
  const _MasonryDelegate(this.ratios, this.gap);
  final List<double> ratios;
  final double gap;

  @override
  SliverGridLayout getLayout(SliverConstraints constraints) {
    final width = math.max(0.0, (constraints.crossAxisExtent - gap) / 2);
    final heights = [0.0, 0.0];
    final boxes = <SliverGridGeometry>[];
    for (final ratio in ratios) {
      final column = heights[0] <= heights[1] ? 0 : 1;
      final height = width / (ratio.isFinite && ratio > 0 ? ratio : .8);
      boxes.add(
        SliverGridGeometry(
          scrollOffset: heights[column],
          crossAxisOffset: column * (width + gap),
          mainAxisExtent: height,
          crossAxisExtent: width,
        ),
      );
      heights[column] += height + gap;
    }
    return _MasonryLayout(boxes);
  }

  @override
  bool shouldRelayout(_MasonryDelegate oldDelegate) => true;
}

class _MasonryLayout extends SliverGridLayout {
  _MasonryLayout(this.boxes) {
    var bottom = 0.0;
    for (final box in boxes) {
      bottom = math.max(bottom, box.scrollOffset + box.mainAxisExtent);
      ends.add(bottom);
    }
  }
  final List<SliverGridGeometry> boxes;
  final List<double> ends = [];

  int _firstGreater(double offset, double Function(int) value) {
    var low = 0;
    var high = boxes.length;
    while (low < high) {
      final mid = (low + high) ~/ 2;
      if (value(mid) <= offset) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  }

  @override
  int getMinChildIndexForScrollOffset(double scrollOffset) => boxes.isEmpty
      ? 0
      : math.min(boxes.length - 1, _firstGreater(scrollOffset, (i) => ends[i]));

  @override
  int getMaxChildIndexForScrollOffset(double scrollOffset) => boxes.isEmpty
      ? 0
      : math.max(
          0,
          _firstGreater(scrollOffset, (i) => boxes[i].scrollOffset) - 1,
        );

  @override
  SliverGridGeometry getGeometryForChildIndex(int index) => boxes[index];

  @override
  double computeMaxScrollOffset(int childCount) =>
      childCount == 0 ? 0 : ends[math.min(childCount, ends.length) - 1];
}
