/// 응원법 진행 계산 (웹 components/common/FanchantLyrics.jsx의 useProgress 대응)
///
/// 화면과 떼어놓은 순수 계산이다 — 재생 시각만 주면 무엇을 강조할지 돌려준다.
library;

import '../models/fanchant.dart';

/// 문서 순서로 편 조각 하나 (줄 번호 + 줄 안 위치 + 시작 시각)
class FanchantPiece {
  final int li;
  final int pi;
  final double? t;
  const FanchantPiece(this.li, this.pi, this.t);
}

/// 한 시점에 무엇을 강조할지
class FanchantFrame {
  /// 지금 조각 (문서 순서 index, 아직 시작 전이면 -1)
  final int cur;

  /// 진하게 칠할 조각들
  final Set<int> active;

  /// 왼쪽 세로 바를 그릴 줄
  final Set<int> lines;

  /// 지금 외칠 응원법 (배경이 들어가는 자리)
  final ({int li, int pi})? call;

  const FanchantFrame({
    required this.cur,
    required this.active,
    required this.lines,
    this.call,
  });
}

class FanchantProgress {
  final List<FanchantLine> lines;

  /// 문서 순서로 편 조각
  final List<FanchantPiece> flat;

  /// 'li-pi' → 문서 순서
  final Map<String, int> rank;

  /// 문단 → [시작 줄, 끝 줄] (빈 줄로 나뉜다)
  final List<List<int>> paragraphs;

  /// 줄 → 문단 번호
  final Map<int, int> paragraphOfLine;

  FanchantProgress._(
    this.lines,
    this.flat,
    this.rank,
    this.paragraphs,
    this.paragraphOfLine,
  );

  factory FanchantProgress(List<FanchantLine> lines) {
    final flat = <FanchantPiece>[];
    double? carry;
    for (var li = 0; li < lines.length; li++) {
      final line = lines[li];
      if (line.gap) continue;
      for (var pi = 0; pi < line.parts.length; pi++) {
        // 아직 안 찍은 조각은 앞 조각 시각을 물려받아 같은 타이밍으로 본다
        final t = line.parts[pi].t ?? (pi == 0 ? line.t : null) ?? carry;
        if (t != null) carry = t;
        // 공백만 있는 조각은 순서에서 뺀다.
        // 앞 조각의 시각을 물려받고 문서상 뒤에 있어서 "지금 조각"을 가로챈다.
        // 응원법 뒤에 공백이 붙어 있으면 그 응원법이 켜지자마자 자리를 빼앗겨
        // 강조가 통째로 안 뜬다(DM의 (listen!)·(special!)). 보일 글자도 없다.
        if (line.parts[pi].text.trim().isEmpty) continue;
        flat.add(FanchantPiece(li, pi, t));
      }
    }

    final paras = <List<int>>[];
    final ofLine = <int, int>{};
    var start = -1;
    for (var li = 0; li < lines.length; li++) {
      if (lines[li].gap) {
        if (start >= 0) {
          paras.add([start, li - 1]);
          start = -1;
        }
        continue;
      }
      if (start < 0) start = li;
      ofLine[li] = paras.length;
    }
    if (start >= 0) paras.add([start, lines.length - 1]);

    return FanchantProgress._(
      lines,
      flat,
      {for (var i = 0; i < flat.length; i++) '${flat[i].li}-${flat[i].pi}': i},
      paras,
      ofLine,
    );
  }

  bool _isCall(FanchantPiece p) => lines[p.li].parts[p.pi].isCall;
  String _text(FanchantPiece p) => lines[p.li].parts[p.pi].text;

  /// 이 시각에 몇 번째 조각까지 왔는가
  int indexAt(double time) {
    var cur = -1;
    for (var i = 0; i < flat.length; i++) {
      final t = flat[i].t;
      if (t != null && time >= t) cur = i;
    }
    return cur;
  }

  /// 지금 외칠 응원법.
  ///
  /// 기본은 그 조각이 지금인 동안만이다 — 지나가면 꺼진다.
  /// 다만 함성처럼 뒤따르는 가사가 흐르는 내내 외치는 자리가 있어,
  /// 관리자가 묶어둔 유지 블록(hg) 안이면 블록이 끝날 때까지 살려둔다.
  ({int li, int pi})? callAt(int cur) {
    if (cur < 0) return null;
    final p = flat[cur];
    if (_isCall(p)) return (li: p.li, pi: p.pi);

    final hg = lines[p.li].hg;
    if (hg == null) return null; // 유지 블록 밖이면 꺼진 것

    for (var i = cur - 1; i >= 0; i--) {
      final c = flat[i];
      if (lines[c.li].hg != hg) break;
      if (_isCall(c)) return (li: c.li, pi: c.pi);
    }
    return null;
  }

  /// 진하게 칠할 조각들.
  ///
  /// 조각을 하나의 순서로만 보면 뒤에 있는 응원법이 앞 가사를 밀어내 가사가 꺼진다.
  /// 두 경우만 함께 살린다.
  ///   - 같은 시각에 시작   "겨울에 난" + "(겨.울.에.난)"
  ///   - 유지 블록 안       "그댄 눈물로 흩어져" → "(프로미스나인)"
  /// 줄 중간 콜("from {summer days} to the")은 종전대로 하나씩 넘어간다.
  Set<int> activeAt(int cur) {
    if (cur < 0) return const {};
    final set = <int>{cur};
    final p = flat[cur];
    if (!_isCall(p)) return set;

    final hg = lines[p.li].hg;
    for (var i = cur - 1; i >= 0; i--) {
      final f = flat[i];
      if (_isCall(f) || _text(f).trim().isEmpty) continue;
      final sameTime = f.t != null && f.t == p.t;
      final sameBlock = hg != null && lines[f.li].hg == hg;
      if (sameTime || sameBlock) set.add(i);
      break; // 가장 가까운 가사 하나만
    }
    return set;
  }

  /// 이 시각에 그릴 것 한 벌
  FanchantFrame frameAt(double time) {
    final cur = indexAt(time);
    final call = callAt(cur);
    final active = activeAt(cur);
    return FanchantFrame(
      cur: cur,
      active: active,
      call: call,
      lines: {
        for (final i in active) flat[i].li,
        // 유지로 살아 있는 응원법이 앞줄에 있으면 그 줄에도 바가 서야 한다
        if (call != null) call.li,
      },
    );
  }
}
