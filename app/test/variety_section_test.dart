// 예능 상세에 '내용'이 나오는지 — 웹과 같은 자리(제목 아래, 방송사 표 위)인지 함께 본다.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fromis9/models/schedule.dart';
import 'package:fromis9/views/schedule/widgets/detail_sections.dart';

ScheduleDetail _variety({String? description}) => ScheduleDetail(
  id: 1,
  title: '아는 형님',
  date: '2026-08-29',
  time: '21:00:00',
  categoryName: '예능',
  broadcaster: 'JTBC',
  description: description,
);

Future<void> _pump(WidgetTester tester, ScheduleDetail s) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: VarietySection(schedule: s, launchUrl: (_) async {}),
        ),
      ),
    ),
  );
}

void main() {
  testWidgets('내용이 있으면 보여준다', (tester) async {
    await _pump(tester, _variety(description: '지원 게스트 출연\n2부에만 등장'));

    expect(find.text('지원 게스트 출연\n2부에만 등장'), findsOneWidget);
    expect(find.text('JTBC'), findsOneWidget);
  });

  testWidgets('내용은 제목 아래, 방송사 위에 온다', (tester) async {
    await _pump(tester, _variety(description: '지원 게스트 출연'));

    final title = tester.getTopLeft(find.text('아는 형님')).dy;
    final desc = tester.getTopLeft(find.text('지원 게스트 출연')).dy;
    final broadcast = tester.getTopLeft(find.text('BROADCAST')).dy;

    expect(desc, greaterThan(title));
    expect(desc, lessThan(broadcast));
  });

  testWidgets('내용이 없으면 빈 자리를 만들지 않는다', (tester) async {
    await _pump(tester, _variety());
    expect(find.text('지원 게스트 출연'), findsNothing);

    final withEmpty = tester.getTopLeft(find.text('BROADCAST')).dy;
    await _pump(tester, _variety(description: ''));
    expect(tester.getTopLeft(find.text('BROADCAST')).dy, withEmpty);
  });
}
