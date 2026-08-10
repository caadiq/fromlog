/// 에디토리얼 공용 모션 — 웹 components/editorial/motion.jsx 대응
///
/// fadeUp: opacity 0→1 · y 18→0 · 650ms · cubic-bezier(0.22, 1, 0.36, 1)
/// stagger: 자식 간 70ms
/// Reveal: 스크롤 진입 시 1회 재생
library;

import 'package:flutter/material.dart';
import 'package:visibility_detector/visibility_detector.dart';

/// 웹 EASE = [0.22, 1, 0.36, 1]
const Curve kEase = Cubic(0.22, 1, 0.36, 1);

/// 웹 fadeUp duration (0.65s)
const Duration kFadeUpDuration = Duration(milliseconds: 650);

/// 웹 staggerChildren 간격 (0.07s)
const int kStaggerMs = 70;

/// 아래에서 올라오며 나타나는 기본 페이드업 (mount 시 재생)
class EFadeUp extends StatefulWidget {
  final Widget child;

  /// 시작 딜레이 (스태거용, ms)
  final int delayMs;

  /// 시작 y 오프셋 (웹 fadeUp: 18)
  final double fromY;

  /// 재생 시간 (기본 kFadeUpDuration 650ms)
  final Duration? duration;

  const EFadeUp({
    super.key,
    required this.child,
    this.delayMs = 0,
    this.fromY = 18,
    this.duration,
  });

  @override
  State<EFadeUp> createState() => _EFadeUpState();
}

class _EFadeUpState extends State<EFadeUp>
    with SingleTickerProviderStateMixin, AutomaticKeepAliveClientMixin {
  // ListView에서 화면 밖으로 나가면 state가 dispose돼 스크롤 복귀 시
  // 애니메이션이 다시 재생된다 — 문서화된 의도(1회 재생)대로 상태를 유지한다
  @override
  bool get wantKeepAlive => true;

  late final AnimationController _controller;
  late final Animation<double> _t;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration ?? kFadeUpDuration,
    );
    _t = CurvedAnimation(parent: _controller, curve: kEase);
    if (widget.delayMs > 0) {
      Future.delayed(Duration(milliseconds: widget.delayMs), () {
        if (mounted) _controller.forward();
      });
    } else {
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context); // AutomaticKeepAliveClientMixin
    return AnimatedBuilder(
      animation: _t,
      builder: (context, child) {
        return Opacity(
          opacity: _t.value.clamp(0, 1),
          child: Transform.translate(
            offset: Offset(0, widget.fromY * (1 - _t.value)),
            child: child,
          ),
        );
      },
      child: widget.child,
    );
  }
}

/// 스크롤 진입 시 1회 페이드업 (웹 Reveal — rootMargin -60px)
class EReveal extends StatefulWidget {
  final Widget child;

  /// 진입 후 추가 딜레이 (스태거용, ms)
  final int delayMs;

  final double fromY;

  const EReveal({
    super.key,
    required this.child,
    this.delayMs = 0,
    this.fromY = 18,
  });

  @override
  State<EReveal> createState() => _ERevealState();
}

class _ERevealState extends State<EReveal>
    with SingleTickerProviderStateMixin, AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  late final AnimationController _controller;
  late final Animation<double> _t;
  bool _played = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: kFadeUpDuration);
    _t = CurvedAnimation(parent: _controller, curve: kEase);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onVisibility(VisibilityInfo info) {
    if (_played) return;
    // 웹 rootMargin -60px 근사 — 요소가 일부라도 60px 이상 보이면 재생
    if (info.visibleBounds.height > 60 || info.visibleFraction > 0.5) {
      _played = true;
      if (widget.delayMs > 0) {
        Future.delayed(Duration(milliseconds: widget.delayMs), () {
          if (mounted) _controller.forward();
        });
      } else {
        _controller.forward();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context); // AutomaticKeepAliveClientMixin
    return VisibilityDetector(
      key: ValueKey('ereveal-${widget.key ?? identityHashCode(this)}'),
      onVisibilityChanged: _onVisibility,
      child: AnimatedBuilder(
        animation: _t,
        builder: (context, child) {
          return Opacity(
            opacity: _t.value.clamp(0, 1),
            child: Transform.translate(
              offset: Offset(0, widget.fromY * (1 - _t.value)),
              child: child,
            ),
          );
        },
        child: widget.child,
      ),
    );
  }
}
