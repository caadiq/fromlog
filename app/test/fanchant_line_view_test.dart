/// 줄마다 글자가 같은 자리에서 시작하는지 실제로 재본다.
/// 눈으로는 몇 px 어긋난 것을 알기 어렵다.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fromis9/models/fanchant.dart';
import 'package:fromis9/views/album/fanchant_line_view.dart';

FanchantLine lyric(String text) =>
    FanchantLine(t: 1, parts: [FanchantPart(text: text, t: 1)]);

FanchantLine call(String text) =>
    FanchantLine(t: 1, parts: [FanchantPart(text: text, type: 'call', t: 1)]);

/// 줄들을 세로로 쌓아 렌더하고 각 텍스트의 왼쪽 좌표를 잰다
Future<List<double>> lefts(
  WidgetTester tester,
  List<FanchantLine> lines, {
  int? callLine,
  Map<int, PieceState> states = const {},
}) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: SizedBox(
          width: 400,
          child: Column(
            children: [
              for (var i = 0; i < lines.length; i++)
                FanchantLineView(
                  line: lines[i],
                  states: {0: states[i] ?? PieceState.upcoming},
                  callPi: callLine == i ? 0 : null,
                  callColor: const Color(0xFF548360),
                  singColor: const Color(0xFF3E6348),
                ),
            ],
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return [
    for (final l in lines)
      tester.getTopLeft(find.text(l.parts.first.text)).dx,
  ];
}

void main() {
  testWidgets('가사 줄과 응원법 줄이 같은 자리에서 시작한다', (tester) async {
    final xs = await lefts(tester, [
      lyric('Vitamin Me'),
      call('(프로미스나인)'),
      lyric('찌는 더위'),
    ]);
    expect(xs[1], xs[0], reason: '응원법 줄이 가사 줄과 어긋나면 안 된다');
    expect(xs[2], xs[0]);
  });

  testWidgets('바가 있든 없든 글자 시작은 그대로다', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 400,
            child: Column(
              children: [
                FanchantLineView(
                  line: lyric('바 없음'),
                  states: const {0: PieceState.upcoming},
                  callColor: const Color(0xFF548360),
                  singColor: const Color(0xFF3E6348),
                ),
                FanchantLineView(
                  line: lyric('바 있음'),
                  states: const {0: PieceState.now},
                  showBar: true,
                  callColor: const Color(0xFF548360),
                  singColor: const Color(0xFF3E6348),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      tester.getTopLeft(find.text('바 있음')).dx,
      tester.getTopLeft(find.text('바 없음')).dx,
    );
  });

  testWidgets('응원법이 켜지면 여백만큼 밀린다 (웹과 같은 동작)', (tester) async {
    final off = await lefts(tester, [call('(프로미스나인)')]);
    final on = await lefts(tester, [call('(프로미스나인)')], callLine: 0);
    expect(
      on.first - off.first,
      FanchantLineView.onPadding.left,
      reason: '켜질 때 좌우 여백이 붙는다 — 웹도 같다',
    );
  });

  testWidgets('가사 상태에 따라 굵기와 색이 바뀐다', (tester) async {
    for (final (state, weight) in [
      (PieceState.now, FontWeight.w800),
      (PieceState.passed, FontWeight.w600),
      (PieceState.upcoming, FontWeight.w600),
    ]) {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FanchantLineView(
              line: lyric('가사'),
              states: {0: state},
              callColor: const Color(0xFF548360),
              singColor: const Color(0xFF3E6348),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final style = tester.widget<Text>(find.text('가사')).style ??
          DefaultTextStyle.of(
            tester.element(find.text('가사')),
          ).style;
      expect(style.fontWeight, weight, reason: '$state');
    }
  });
}
