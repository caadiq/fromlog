/// 행사 상세의 '내용' — 멤버별 참여가 갈릴 때 적는 자리.
///
/// 대학 축제는 뮤지컬 일정 등으로 특정 멤버가 빠지는 경우가 있는데
/// 그걸 적을 항목이 없었다. 기타·예능과 같은 자유 텍스트 한 칸.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fromis9/models/schedule.dart';
import 'package:fromis9/views/schedule/widgets/detail_sections.dart';

ScheduleDetail _event({String? description}) => ScheduleDetail(
  id: 1,
  title: '가천대학교 무한전야 : UTOPIA',
  date: '2026-09-16',
  categoryName: '행사',
  subtype: 'general',
  description: description,
);

Future<void> _pump(WidgetTester tester, ScheduleDetail s) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: EventSection(schedule: s, launchUrl: (_) async {}),
        ),
      ),
    ),
  );
}

void main() {
  testWidgets('내용이 있으면 제목 아래에 보여준다', (tester) async {
    await _pump(tester, _event(description: '박지원 뮤지컬 <헬스키친> 일정으로 불참'));

    expect(find.text('박지원 뮤지컬 <헬스키친> 일정으로 불참'), findsOneWidget);

    final title = tester.getTopLeft(find.text('가천대학교 무한전야 : UTOPIA')).dy;
    final desc = tester.getTopLeft(find.text('박지원 뮤지컬 <헬스키친> 일정으로 불참')).dy;
    final date = tester.getTopLeft(find.text('DATE')).dy;
    expect(desc, greaterThan(title));
    expect(desc, lessThan(date));
  });

  testWidgets('내용이 없으면 빈 자리를 만들지 않는다', (tester) async {
    await _pump(tester, _event());
    final withoutDesc = tester.getTopLeft(find.text('DATE')).dy;

    await _pump(tester, _event(description: ''));
    expect(tester.getTopLeft(find.text('DATE')).dy, withoutDesc);
  });
}
