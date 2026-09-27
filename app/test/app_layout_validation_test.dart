import 'dart:io';
import 'dart:ui' as ui;
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fromis9/controllers/schedule_controller.dart';
import 'package:fromis9/services/api_client.dart';
import 'package:fromis9/views/schedule/schedule_view.dart';
import 'package:fromis9/widgets/e_motion.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AuditMonth extends ScheduleController {
  @override
  ScheduleState build() => ScheduleState(selectedDate: DateTime(2026, 1, 31));
}

class ReadOnlyAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions o,
    Stream<Uint8List>? stream,
    Future<void>? cancel,
  ) async => ResponseBody.fromString(
    o.path == '/schedule-links' ? '[]' : '{"schedules":[],"hasMore":false}',
    200,
    headers: {
      Headers.contentTypeHeader: ['application/json'],
    },
  );
  @override
  void close({bool force = false}) {}
}

Future<void> capture(WidgetTester tester, GlobalKey key, String name) async {
  if (Platform.environment['APP_AUDIT_OUTPUT'] == null) return;
  await tester.runAsync(() async {
    final boundary =
        key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    final image = await boundary.toImage();
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    final dir = Directory(Platform.environment['APP_AUDIT_OUTPUT']!);
    await dir.create(recursive: true);
    await File(
      '${dir.path}/$name.png',
    ).writeAsBytes(bytes!.buffer.asUint8List());
    image.dispose();
  });
}

void main() {
  late HttpClientAdapter original;
  setUpAll(() async {
    await initializeDateFormatting('ko');
    final font = FontLoader('Pretendard')
      ..addFont(rootBundle.load('assets/fonts/Pretendard-Regular.otf'))
      ..addFont(rootBundle.load('assets/fonts/Pretendard-Bold.otf'));
    await font.load();
    final icons = FontLoader('packages/lucide_icons/Lucide')
      ..addFont(rootBundle.load('packages/lucide_icons/assets/lucide.ttf'));
    await icons.load();
    final material = FontLoader('MaterialIcons')
      ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await material.load();
  });
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    original = dio.httpClientAdapter;
    dio.httpClientAdapter = ReadOnlyAdapter();
  });
  tearDown(() => dio.httpClientAdapter = original);
  for (final size in [
    const Size(320, 568),
    const Size(844, 390),
    const Size(800, 1100),
  ]) {
    testWidgets('calendar fits $size, aligns with selected month and closes', (
      tester,
    ) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = size;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final key = GlobalKey();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [scheduleProvider.overrideWith(AuditMonth.new)],
          child: MaterialApp(
            theme: ThemeData(fontFamily: 'Pretendard'),
            home: RepaintBoundary(
              key: key,
              child: const Scaffold(body: ScheduleView()),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(LucideIcons.grid));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(
        find.byKey(const ValueKey('calendar-day-2026-1-31')),
        findsOneWidget,
      );
      await capture(
        tester,
        key,
        'app-calendar-${size.width.toInt()}x${size.height.toInt()}',
      );
      final day = find.byKey(const ValueKey('calendar-day-2026-1-15'));
      await tester.ensureVisible(day);
      await tester.pumpAndSettle();
      await tester.tap(day);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      final container = ProviderScope.containerOf(
        tester.element(find.byType(ScheduleView)),
      );
      expect(
        container.read(scheduleProvider).selectedDate,
        DateTime(2026, 1, 15),
      );
      await tester.tap(find.byIcon(LucideIcons.grid));
      await tester.pumpAndSettle();
      expect(
        find.byKey(const ValueKey('calendar-day-2026-1-31')),
        findsOneWidget,
      );
      await tester.tap(find.text('2026. 1'));
      await tester.pumpAndSettle();
      final feb = find.text('2').last;
      await tester.ensureVisible(feb);
      await tester.tap(feb);
      await tester.pumpAndSettle();
      expect(
        find.byKey(const ValueKey('calendar-day-2026-2-28')),
        findsOneWidget,
      );
      expect(find.text('2026. 2'), findsOneWidget);
      for (var i = 0; i < 3; i++) {
        await tester.tap(find.text('2026. 2'));
        await tester.pump(const Duration(milliseconds: 80));
      }
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  }
  testWidgets('reduced motion reveals delayed content immediately', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: MediaQuery(
          data: MediaQueryData(disableAnimations: true),
          child: EFadeUp(delayMs: 900, child: Text('즉시 표시')),
        ),
      ),
    );
    final opacity = find.ancestor(
      of: find.text('즉시 표시'),
      matching: find.byType(Opacity),
    );
    expect(
      opacity.evaluate().isEmpty ||
          tester.widget<Opacity>(opacity.first).opacity == 1,
      isTrue,
    );
    await tester.pump(const Duration(seconds: 1));
  });
}
