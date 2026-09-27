import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:visibility_detector/visibility_detector.dart';
import 'package:fromis9/services/api_client.dart';
import 'package:fromis9/views/main_shell.dart';
import 'package:fromis9/views/schedule/schedule_view.dart';
import 'package:fromis9/views/schedule/schedule_detail_view.dart';

class NavigationAdapter implements HttpClientAdapter {
  int detailStatus = 200;
  @override
  Future<ResponseBody> fetch(
    RequestOptions o,
    Stream<Uint8List>? request,
    Future<void>? cancel,
  ) async {
    final detail = RegExp(r'^/schedules/\d+$').hasMatch(o.path);
    final item = {
      'id': 123,
      'title': o.path == '/schedules/124' ? '다른 일정' : '검색된 일정',
      'date': '2026-09-27',
      'category': {'id': 1, 'name': '기타'},
    };
    final Object data = detail
        ? item
        : o.path == '/schedule-links'
        ? []
        : o.path.contains('suggestions')
        ? {'suggestions': []}
        : {
            'schedules': o.queryParameters.containsKey('search') ? [item] : [],
            'hasMore': false,
          };
    return ResponseBody.fromString(
      jsonEncode(data),
      detail ? detailStatus : 200,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  late HttpClientAdapter original;
  late NavigationAdapter adapter;
  setUpAll(() => initializeDateFormatting('ko'));
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    VisibilityDetectorController.instance.updateInterval = Duration.zero;
    original = dio.httpClientAdapter;
    adapter = NavigationAdapter();
    dio.httpClientAdapter = adapter;
  });
  tearDown(() => dio.httpClientAdapter = original);
  testWidgets(
    'shell Back closes search without exit warning and detail restores results',
    (tester) async {
      final router = GoRouter(
        initialLocation: '/schedule',
        routes: [
          ShellRoute(
            builder: (context, state, child) => MainShell(child: child),
            routes: [
              GoRoute(
                path: '/schedule',
                builder: (_, _) => const ScheduleView(),
              ),
              GoRoute(path: '/', builder: (_, _) => const Text('HOME')),
            ],
          ),
          GoRoute(
            path: '/schedule/:id',
            builder: (_, _) => ScheduleDetailView(scheduleId: 123),
          ),
        ],
      );
      await tester.pumpWidget(
        ProviderScope(child: MaterialApp.router(routerConfig: router)),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(LucideIcons.search));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '검색');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();
      await tester.tap(find.textContaining('검색된 일정', findRichText: true).first);
      await tester.pumpAndSettle();
      expect(find.byType(ScheduleDetailView), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(router.routeInformationProvider.value.uri.path, '/schedule');
      expect(find.textContaining('검색된 일정', findRichText: true), findsWidgets);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byType(TextField), findsOneWidget);
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        isEmpty,
      );
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byType(TextField), findsNothing);
      expect(find.text('한 번 더 누르면 앱이 종료됩니다'), findsNothing);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      router.dispose();
    },
  );
  testWidgets(
    'detail server error is retryable and different from missing record',
    (tester) async {
      adapter.detailStatus = 500;
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(home: ScheduleDetailView(scheduleId: 123)),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('404'), findsNothing);
      expect(find.text('일정을 불러오지 못했습니다.'), findsOneWidget);
      adapter.detailStatus = 200;
      await tester.tap(find.text('다시 시도'));
      await tester.pumpAndSettle();
      expect(find.text('검색된 일정'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(home: ScheduleDetailView(scheduleId: 124)),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('다른 일정'), findsOneWidget);
      expect(find.text('검색된 일정'), findsNothing);
      await tester.pumpWidget(const SizedBox());
      adapter.detailStatus = 404;
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(home: ScheduleDetailView(scheduleId: 123)),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('404'), findsOneWidget);
    },
  );
}
