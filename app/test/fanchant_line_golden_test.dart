/// 실제 폰트로 그려 눈으로 확인하는 용도.
/// `flutter test --update-goldens test/fanchant_line_golden_test.dart` 로 이미지를 만든다.
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fromis9/models/fanchant.dart';
import 'package:fromis9/views/album/fanchant_line_view.dart';

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    // 실제 폰트를 올려야 글자 여백까지 실제와 같아진다
    for (final w in ['SemiBold', 'ExtraBold', 'Black']) {
      final loader = FontLoader('Pretendard')
        ..addFont(
          File('assets/fonts/Pretendard-$w.otf')
              .readAsBytes()
              .then((b) => ByteData.view(b.buffer)),
        );
      await loader.load();
    }
  });

  testWidgets('줄 정렬 (재생 전)', (tester) async {
    final lines = <FanchantLine>[
      FanchantLine(t: 1, parts: [FanchantPart(text: 'Mm I think you need a dose of', t: 1)]),
      FanchantLine(t: 2, parts: [FanchantPart(text: 'Vitamin Me', t: 2)]),
      FanchantLine(t: 3, parts: [FanchantPart(text: '(프 로 미 스 나 인)', type: 'call', t: 3)]),
      FanchantLine(t: 4, parts: [
        FanchantPart(text: '찌는 ', t: 4),
        FanchantPart(text: '더위', type: 'sing', t: 4.5),
      ]),
    ];
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(fontFamily: 'Pretendard'),
        home: Scaffold(
          backgroundColor: const Color(0xFFFBFBF9),
          body: Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final l in lines)
                  FanchantLineView(
                    line: l,
                    states: const {0: PieceState.upcoming, 1: PieceState.upcoming},
                    callColor: const Color(0xFF2E7D46),
                    singColor: const Color(0xFF1F6E7A),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await expectLater(
      find.byType(Scaffold),
      matchesGoldenFile('goldens/line_idle.png'),
    );
  });

  testWidgets('응원법이 켜졌을 때', (tester) async {
    final lines = <FanchantLine>[
      FanchantLine(t: 1, parts: [FanchantPart(text: 'Vitamin Me', t: 1)]),
      FanchantLine(t: 2, parts: [FanchantPart(text: '(프 로 미 스 나 인)', type: 'call', t: 2)]),
      FanchantLine(t: 3, parts: [FanchantPart(text: '찌는 더위', t: 3)]),
    ];
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(fontFamily: 'Pretendard'),
        home: Scaffold(
          backgroundColor: const Color(0xFFFBFBF9),
          body: Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                FanchantLineView(
                  line: lines[0],
                  states: const {0: PieceState.passed},
                  callColor: const Color(0xFF2E7D46),
                  singColor: const Color(0xFF1F6E7A),
                ),
                FanchantLineView(
                  line: lines[1],
                  states: const {0: PieceState.now},
                  callPi: 0,
                  showBar: true,
                  callColor: const Color(0xFF2E7D46),
                  singColor: const Color(0xFF1F6E7A),
                ),
                FanchantLineView(
                  line: lines[2],
                  states: const {0: PieceState.upcoming},
                  callColor: const Color(0xFF2E7D46),
                  singColor: const Color(0xFF1F6E7A),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await expectLater(
      find.byType(Scaffold),
      matchesGoldenFile('goldens/line_active.png'),
    );
  });
}
