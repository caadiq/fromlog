// 팬사인회 장소는 선택 — 공개 팬사인회만 나오고, 없으면 종전 안내 문구를 유지한다.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fromis9/models/schedule.dart';
import 'package:fromis9/views/schedule/widgets/detail_sections.dart';

ScheduleDetail _fansign({Venue? venue}) => ScheduleDetail(
  id: 1,
  title: '[Glow ME] 발매 기념 공개 팬사인회 (뮤직아트)',
  date: '2026-08-30',
  time: '14:00:00',
  categoryName: '팬사인회',
  format: 'offline',
  fansignHost: '뮤직아트',
  venue: venue,
);

Future<void> _pump(WidgetTester tester, ScheduleDetail s) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: FansignSection(schedule: s, launchUrl: (_) async {}),
        ),
      ),
    ),
  );
}

void main() {
  testWidgets('장소가 있으면 VENUE로 보여준다', (tester) async {
    await _pump(
      tester,
      _fansign(
        venue: Venue(
          name: '스타필드 수원',
          address: '경기 수원시 장안구 정자동 111-14',
        ),
      ),
    );

    expect(find.text('VENUE'), findsOneWidget);
    expect(find.text('스타필드 수원'), findsOneWidget);
    expect(find.text('경기 수원시 장안구 정자동 111-14'), findsOneWidget);
    // 장소가 있으면 개별 안내 문구는 빠진다
    expect(find.text('장소는 당첨자에게 개별 안내됩니다.'), findsNothing);
  });

  testWidgets('장소가 없으면 종전대로 개별 안내 문구', (tester) async {
    await _pump(tester, _fansign());

    expect(find.text('VENUE'), findsNothing);
    expect(find.text('장소는 당첨자에게 개별 안내됩니다.'), findsOneWidget);
    expect(find.text('뮤직아트'), findsOneWidget);
  });
}
