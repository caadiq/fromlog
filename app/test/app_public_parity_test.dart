import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:visibility_detector/visibility_detector.dart';
import 'package:fromis9/controllers/home_controller.dart';
import 'package:fromis9/controllers/schedule_controller.dart';
import 'package:fromis9/services/api_client.dart';
import 'package:fromis9/views/album/album_detail_view.dart';
import 'package:fromis9/views/schedule/schedule_view.dart';
import 'package:fromis9/views/schedule/widgets/schedule_editorial.dart';
import 'package:fromis9/widgets/content_state.dart';
import 'package:fromis9/widgets/masonry_scroll_view.dart';
import 'app_layout_validation_test.dart' show capture;

class ParityMonth extends ScheduleController {
  @override
  ScheduleState build() => ScheduleState(selectedDate: DateTime(2026, 9, 27));
}

class ParityAdapter implements HttpClientAdapter {
  int memberStatus = 500;
  int albumStatus = 500;
  bool failNextSearch = false;
  bool paginated = false;
  int searchRequests = 0;
  final paths = <String>[];
  @override
  Future<ResponseBody> fetch(
    RequestOptions o,
    Stream<Uint8List>? stream,
    Future<void>? cancel,
  ) async {
    paths.add(o.path);
    int status = 200;
    Object body = <Object>[];
    if (o.path == '/members') {
      status = memberStatus;
    } else if (o.path == '/albums') {
      body = [
        {'id': 1, 'title': '정상 앨범'},
      ];
    } else if (o.path.startsWith('/albums/')) {
      status = albumStatus;
      body = {'id': 1, 'title': '정상 앨범', 'tracks': []};
    } else if (o.queryParameters.containsKey('search')) {
      searchRequests++;
      if (failNextSearch) {
        status = 500;
        failNextSearch = false;
      }
      final next = o.queryParameters['offset'].toString() != '0';
      final items = List.generate(
        paginated && !next ? 20 : 3,
        (i) => {
          'id': next ? i + 100 : i,
          'title': next ? '검색 다음 페이지 $i' : '워크돌 프로미스나인 지원과 함께하는 새로운 이야기 $i',
          'date': '2026-09-27',
          'time': '19:00:00',
          'datePrecision': i == 1 ? 'month' : 'day',
          'source': {'name': '워크맨-Workman'},
          'category': {
            'id': next ? 2 : 1,
            'name': next ? 'X' : '유튜브',
            'color': '#ff0033',
          },
        },
      );
      body = {'schedules': items, 'hasMore': paginated && !next};
    } else if (o.path == '/schedules') {
      body = {'schedules': [], 'hasMore': false};
    } else if (o.path.endsWith('/suggestions')) {
      body = {'suggestions': []};
    }
    return ResponseBody.fromString(
      jsonEncode(body),
      status,
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
  late ParityAdapter adapter;
  setUpAll(() async {
    await initializeDateFormatting('ko');
    final font = FontLoader('Pretendard')
      ..addFont(rootBundle.load('assets/fonts/Pretendard-Regular.otf'))
      ..addFont(rootBundle.load('assets/fonts/Pretendard-Bold.otf'));
    await font.load();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
    await (FontLoader('packages/lucide_icons/Lucide')
          ..addFont(rootBundle.load('packages/lucide_icons/assets/lucide.ttf')))
        .load();
  });
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    VisibilityDetectorController.instance.updateInterval = Duration.zero;
    original = dio.httpClientAdapter;
    adapter = ParityAdapter();
    dio.httpClientAdapter = adapter;
  });
  tearDown(() => dio.httpClientAdapter = original);

  Future<ProviderContainer> schedule(
    WidgetTester tester, {
    GlobalKey? captureKey,
  }) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [scheduleProvider.overrideWith(ParityMonth.new)],
        child: MaterialApp(
          theme: ThemeData(fontFamily: 'Pretendard'),
          home: RepaintBoundary(
            key: captureKey,
            child: const Scaffold(body: ScheduleView()),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    return ProviderScope.containerOf(tester.element(find.byType(ScheduleView)));
  }

  Future<void> search(WidgetTester tester) async {
    await tester.tap(find.byIcon(LucideIcons.search));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '워크돌');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();
  }

  for (final width in [320.0, 390.0, 800.0]) {
    testWidgets('search date column and month header fit width $width', (
      tester,
    ) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = Size(width, 844);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final key = GlobalKey();
      await schedule(tester, captureKey: key);
      final title = tester.getRect(find.text('2026. 9'));
      final next = tester.getRect(find.byIcon(Icons.chevron_right));
      expect(next.left - title.right, lessThan(16));
      await capture(tester, key, 'month-header-${width.toInt()}');
      await search(tester);
      expect(find.byType(SearchRow), findsNWidgets(3));
      expect(find.text('날짜 미정'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await capture(tester, key, 'search-parity-${width.toInt()}');
    });
  }
  testWidgets(
    'empty filtered first page keeps loading and filter is removable',
    (tester) async {
      adapter.paginated = true;
      final container = await schedule(tester);
      container.read(scheduleProvider.notifier).toggleCategory(2);
      await search(tester);
      expect(adapter.searchRequests, 2);
      expect(
        find.textContaining('검색 다음 페이지', findRichText: true),
        findsWidgets,
      );
      expect(
        find.textContaining('워크돌 프로미스나인', findRichText: true),
        findsNothing,
      );
      await tester.tap(find.text('X').first);
      await tester.pumpAndSettle();
      expect(container.read(scheduleProvider).selectedCategories, isEmpty);
      expect(
        find.textContaining('워크돌 프로미스나인', findRichText: true),
        findsWidgets,
      );
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('search error is retryable, not displayed as no results', (
    tester,
  ) async {
    adapter.failNextSearch = true;
    await schedule(tester);
    await search(tester);
    expect(find.text('검색 결과를 불러오지 못했습니다.'), findsOneWidget);
    expect(find.text('검색 결과가 없습니다'), findsNothing);
    await tester.tap(find.text('다시 시도'));
    await tester.pumpAndSettle();
    expect(find.byType(SearchRow), findsWidgets);
    expect(adapter.searchRequests, 2);
  });
  testWidgets('album server failure retries and true 404 has no retry', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: AlbumDetailView(albumName: 'example')),
    );
    await tester.pumpAndSettle();
    expect(find.text('앨범을 불러오지 못했습니다.'), findsOneWidget);
    adapter.albumStatus = 200;
    await tester.tap(find.text('다시 시도'));
    await tester.pumpAndSettle();
    expect(find.text('정상 앨범'), findsWidgets);
    expect(find.byType(ContentState), findsNothing);
    await tester.pumpWidget(const SizedBox());
    adapter.albumStatus = 404;
    await tester.pumpWidget(
      const MaterialApp(home: AlbumDetailView(albumName: 'missing')),
    );
    await tester.pumpAndSettle();
    expect(find.text('앨범을 찾을 수 없습니다.'), findsOneWidget);
    expect(find.text('다시 시도'), findsNothing);
  });
  testWidgets('600 photos stay lazy, reach the end and fit after resize', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 844);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MasonryScrollView<int>(
            items: List.generate(600, (i) => i),
            ratioOf: (i) => i.isEven ? .8 : 1.5,
            itemBuilder: (_, i, _) =>
                ColoredBox(color: Colors.grey, child: Text('사진 $i')),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(Text).evaluate().length, lessThan(40));
    final position = tester
        .state<ScrollableState>(find.byType(Scrollable))
        .position;
    position.jumpTo(position.maxScrollExtent);
    await tester.pumpAndSettle();
    expect(find.text('사진 599'), findsOneWidget);
    expect(find.byType(Text).evaluate().length, lessThan(40));
    tester.view.physicalSize = const Size(800, 1100);
    await tester.pumpAndSettle();
    position.jumpTo(position.maxScrollExtent);
    await tester.pumpAndSettle();
    expect(find.text('사진 599'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  test(
    'home preserves successful sections and retries only the failed section',
    () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      container.read(homeProvider);
      for (var i = 0; i < 30; i++) {
        await Future<void>.delayed(Duration.zero);
      }
      expect(container.read(homeProvider).albums.single.title, '정상 앨범');
      expect(container.read(homeProvider).sectionErrors.keys, ['members']);
      final albumCalls = adapter.paths.where((p) => p == '/albums').length;
      adapter.memberStatus = 200;
      await container.read(homeProvider.notifier).loadData(section: 'members');
      expect(container.read(homeProvider).sectionErrors, isEmpty);
      expect(container.read(homeProvider).members, isEmpty);
      expect(adapter.paths.where((p) => p == '/albums').length, albumCalls);
    },
  );
}
