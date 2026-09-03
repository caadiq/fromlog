/// 응원법 조각 뒤에 공백이 붙어 있어도 강조가 뜨는지.
///
/// DM은 "넌 So special {(special!)} "처럼 응원법 뒤에 공백 조각이 남아 있다.
/// 그 공백이 앞 조각의 시각을 물려받고 문서상 뒤에 있어서 "지금 조각"을 가로채는 바람에,
/// 정작 외쳐야 할 (special!)·(listen!)이 켜지자마자 꺼져 화면에 전혀 안 떴다.
library;

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:fromis9/core/fanchant_progress.dart';
import 'package:fromis9/models/fanchant.dart';

void main() {
  late Fanchant dm;
  late FanchantProgress p;

  setUpAll(() {
    dm = Fanchant.fromJson(
      jsonDecode(File('test/fixtures/fanchant_93.json').readAsStringSync())
          as Map<String, dynamic>,
    );
    p = FanchantProgress(dm.lines);
  });

  /// 그 시각에 외치라고 표시되는 응원법 글자
  String? callText(double time) {
    final c = p.callAt(p.indexAt(time));
    if (c == null) return null;
    return dm.lines[c.li].parts[c.pi].text.trim();
  }

  test('(special!) 구간 내내 강조된다 — 뒤 공백에 자리를 안 뺏긴다', () {
    // 데이터상 (special!)은 167.4, 다음 줄은 168.24에 시작한다
    expect(callText(167.3), isNot('(special!)')); // 아직 이르다
    expect(callText(167.45), '(special!)');
    expect(callText(167.9), '(special!)');
    expect(callText(168.2), '(special!)');
    expect(callText(168.3), isNot('(special!)')); // 다음 줄로 넘어갔다
  });

  test('(listen!)도 마찬가지', () {
    final line = dm.lines.firstWhere(
      (l) => l.parts.any((x) => x.text.contains('(listen!)')),
    );
    final call = line.parts.firstWhere((x) => x.text.contains('(listen!)'));
    final t = call.t!;
    expect(callText(t + 0.05), '(listen!)');
    expect(callText(t + 0.4), '(listen!)');
  });

  test('공백 조각은 순서에서 빠진다', () {
    for (final piece in p.flat) {
      expect(
        dm.lines[piece.li].parts[piece.pi].text.trim(),
        isNotEmpty,
        reason: 'line${piece.li}/part${piece.pi}가 공백인데 순서에 들어 있다',
      );
    }
  });
}
