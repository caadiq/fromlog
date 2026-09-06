import 'dart:async';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:fromis9/controllers/schedule_controller.dart';
import 'package:fromis9/services/api_client.dart';
import 'package:fromis9/views/schedule/schedule_view.dart';

class EmptyMonth extends ScheduleController {
  @override
  ScheduleState build() => ScheduleState(selectedDate: DateTime(2026, 9, 6));
}

class ViewAdapter implements HttpClientAdapter {
  final pending = <Completer<ResponseBody>>[];
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? stream,
    Future<void>? cancel,
  ) async {
    if (options.path == '/schedules/suggestions') {
      final request = Completer<ResponseBody>();
      pending.add(request);
      return request.future;
    }
    return ResponseBody.fromString(
      options.path == '/schedule-links'
          ? '[]'
          : '{"schedules":[],"hasMore":false}',
      200,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  late ViewAdapter adapter;
  late HttpClientAdapter originalAdapter;
  setUpAll(() async {
    await initializeDateFormatting('ko');
  });
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    originalAdapter = dio.httpClientAdapter;
    adapter = ViewAdapter();
    dio.httpClientAdapter = adapter;
  });
  tearDown(() {
    dio.httpClientAdapter = originalAdapter;
  });

  Future<void> openSearch(WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [scheduleProvider.overrideWith(EmptyMonth.new)],
        child: const MaterialApp(home: Scaffold(body: ScheduleView())),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(LucideIcons.search));
    await tester.pumpAndSettle();
    expect(find.byType(TextField), findsOneWidget);
  }

  Future<void> pumpIo(WidgetTester tester) async {
    for (var i = 0; i < 15; i++) {
      await tester.pump();
    }
  }

  void finishSuggestions() {
    for (final pending in adapter.pending) {
      if (!pending.isCompleted) {
        pending.complete(
          ResponseBody.fromString(
            '{"suggestions":["하영 이전 추천"]}',
            200,
            headers: {
              Headers.contentTypeHeader: ['application/json'],
            },
          ),
        );
      }
    }
  }

  testWidgets(
    'clearing input cancels suggestions waiting in the debounce timer',
    (tester) async {
      await openSearch(tester);
      await tester.enterText(find.byType(TextField), '하영');
      await tester.pump();
      await tester.tap(find.byIcon(Icons.close));
      await tester.pump(const Duration(milliseconds: 300));
      await pumpIo(tester);
      expect(adapter.pending, isEmpty);
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        isEmpty,
      );
    },
  );
  testWidgets(
    'input change rejects an old response before the next debounce fires',
    (tester) async {
      await openSearch(tester);
      await tester.enterText(find.byType(TextField), '하영');
      await tester.pump(const Duration(milliseconds: 210));
      await pumpIo(tester);
      expect(adapter.pending, hasLength(1));
      await tester.enterText(find.byType(TextField), '지원');
      finishSuggestions();
      await pumpIo(tester);
      expect(find.text('하영 이전 추천'), findsNothing);
      await tester.tap(find.byIcon(Icons.close));
      await tester.pump(const Duration(milliseconds: 300));
      expect(adapter.pending, hasLength(1));
    },
  );
  testWidgets('submitting search cancels the pending suggestion timer', (
    tester,
  ) async {
    await openSearch(tester);
    await tester.enterText(find.byType(TextField), '지원');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pump(const Duration(milliseconds: 300));
    await pumpIo(tester);
    expect(adapter.pending, isEmpty);
  });
}
