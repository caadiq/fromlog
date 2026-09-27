import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fromis9/services/api_client.dart';
import 'package:fromis9/services/push_navigation.dart';
import 'package:fromis9/views/video/video_list_view.dart';
import 'package:fromis9/update/update_dialog.dart';
import 'package:fromis9/update/update_info.dart';
import 'package:fromis9/widgets/youtube/youtube_fullscreen.dart';
import 'package:visibility_detector/visibility_detector.dart';

class DeferredVideoAdapter implements HttpClientAdapter {
  final calls =
      <({RequestOptions options, Completer<ResponseBody> response})>[];
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? request,
    Future<void>? cancel,
  ) {
    final response = Completer<ResponseBody>();
    calls.add((options: options, response: response));
    return response.future;
  }

  @override
  void close({bool force = false}) {}
  void finish(
    int index, {
    String title = '새 영상',
    int status = 200,
    bool more = false,
    int count = 1,
    bool channels = false,
  }) {
    calls[index].response.complete(
      ResponseBody.fromString(
        jsonEncode({
          'videos': List.generate(
            count,
            (i) => {
              'videoId': 'testvid${i.toString().padLeft(4, '0')}',
              'title': count == 1 ? title : '$title $i',
              'publishedAt': '2026-09-26',
              'channelName': '검증 채널',
            },
          ),
          'total': more ? 48 : count,
          'offset': 0,
          'limit': 24,
          'hasMore': more,
          'facets': {
            'channels': channels
                ? List.generate(20, (i) => {'name': '채널 $i', 'count': i + 1})
                : [],
          },
        }),
        status,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      ),
    );
  }
}

Future<void> flush(WidgetTester tester) async {
  for (var i = 0; i < 12; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  late HttpClientAdapter original;
  late DeferredVideoAdapter adapter;
  setUp(() {
    original = dio.httpClientAdapter;
    adapter = DeferredVideoAdapter();
    dio.httpClientAdapter = adapter;
    VisibilityDetectorController.instance.updateInterval = Duration.zero;
  });
  tearDown(() => dio.httpClientAdapter = original);
  Future<void> mount(WidgetTester tester, String category) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: VideoListView(category: category)),
      ),
    );
    await flush(tester);
  }

  testWidgets('late video response after leaving screen is harmless', (
    tester,
  ) async {
    await mount(tester, 'variety');
    expect(adapter.calls.length, 1);
    await tester.pumpWidget(const SizedBox());
    adapter.finish(0);
    await flush(tester);
    expect(tester.takeException(), isNull);
  });
  testWidgets('old category response never overwrites newer selection', (
    tester,
  ) async {
    await mount(tester, 'variety');
    await mount(tester, 'music');
    expect(adapter.calls.length, 2);
    adapter.finish(1, title: '현재 채널');
    await flush(tester);
    adapter.finish(0, title: '이전 채널');
    await flush(tester);
    expect(find.text('현재 채널'), findsOneWidget);
    expect(find.text('이전 채널'), findsNothing);
    expect(tester.takeException(), isNull);
  });
  testWidgets('initial video failure can be retried', (tester) async {
    await mount(tester, 'variety');
    adapter.finish(0, status: 500);
    await flush(tester);
    await tester.tap(find.text('다시 시도'));
    await flush(tester);
    adapter.finish(1);
    await flush(tester);
    expect(find.text('새 영상'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('pagination failure keeps existing items and waits for retry', (
    tester,
  ) async {
    await mount(tester, 'variety');
    adapter.finish(0, more: true, count: 24, title: '기존 영상');
    await flush(tester);
    final scroll = tester
        .widget<ListView>(find.byType(ListView).first)
        .controller!;
    scroll.jumpTo(scroll.position.maxScrollExtent);
    await flush(tester);
    expect(adapter.calls.length, 2);
    adapter.finish(1, status: 500);
    await flush(tester);
    expect(find.text('기존 영상 0', skipOffstage: false), findsOneWidget);
    expect(find.text('다음 영상을 불러오지 못했습니다'), findsOneWidget);
    scroll.jumpTo(scroll.position.maxScrollExtent - 10);
    await flush(tester);
    expect(adapter.calls.length, 2);
    await tester.ensureVisible(find.text('다시 시도'));
    await tester.tap(find.text('다시 시도'));
    await flush(tester);
    expect(adapter.calls.last.options.queryParameters['offset'], '24');
    adapter.finish(2, title: '추가 영상');
    await flush(tester);
    expect(find.text('추가 영상', skipOffstage: false), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('channel menu stays inside a short viewport and Back closes it', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(844, 390);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await mount(tester, 'variety');
    adapter.finish(0, channels: true);
    await flush(tester);
    await tester.tap(find.text('전체 채널'));
    await tester.pumpAndSettle();
    final menu = find
        .ancestor(
          of: find.text('채널 0'),
          matching: find.byType(SingleChildScrollView),
        )
        .first;
    expect(tester.getRect(menu).bottom, lessThanOrEqualTo(390));
    expect(tester.getRect(menu).top, greaterThanOrEqualTo(0));
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('채널 0'), findsNothing);
    expect(find.text('새 영상'), findsOneWidget);
  });
  testWidgets('long update notes remain usable on short narrow viewport', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(320, 390));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => showUpdateDialog(
                context,
                UpdateInfo(
                  versionCode: 9999,
                  versionName: '2.0.0-very-long-version-name',
                  downloadUrl: 'https://example.test/a.apk',
                  changelog: List.filled(30, '업데이트 내용입니다.').join('\n'),
                  mandatory: false,
                  size: 20,
                  sha256: 'test',
                ),
              ),
              child: const Text('열기'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('열기'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.ensureVisible(find.text('나중에'));
    await tester.tap(find.text('나중에'));
    await tester.pumpAndSettle();
    expect(find.byType(UpdateDialog), findsNothing);
  });
  testWidgets('fullscreen Back notifies WebView once; late hide keeps detail', (
    tester,
  ) async {
    final key = GlobalKey<NavigatorState>();
    final fullscreen = YoutubeFullscreenSession();
    var nativeExit = 0;
    await tester.pumpWidget(
      MaterialApp(
        navigatorKey: key,
        home: const Scaffold(body: Text('목록')),
      ),
    );
    key.currentState!.push(
      MaterialPageRoute<void>(builder: (_) => const Scaffold(body: Text('상세'))),
    );
    await tester.pumpAndSettle();
    unawaited(
      fullscreen.show(
        navigator: key.currentState!,
        content: const Text('영상 전체화면'),
        aspectRatio: 16 / 9,
        onFlutterExit: () => nativeExit++,
      ),
    );
    await tester.pumpAndSettle();
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(nativeExit, 1);
    fullscreen.hide();
    await tester.pumpAndSettle();
    expect(find.text('상세'), findsOneWidget);
    unawaited(
      fullscreen.show(
        navigator: key.currentState!,
        content: const Text('다시 전체화면'),
        aspectRatio: 9 / 16,
        onFlutterExit: () => nativeExit++,
      ),
    );
    await tester.pumpAndSettle();
    fullscreen.hide();
    await tester.pumpAndSettle();
    expect(nativeExit, 1);
    expect(find.text('상세'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  test(
    'cold notification waits for startup and duplicate taps open once',
    () async {
      final opened = <Uri>[];
      final nav = PushNavigation(
        open: (uri) async {
          opened.add(uri);
          return true;
        },
      );
      nav.receive({
        'type': 'schedule_queue',
        'url': 'https://untrusted.test/',
      }, messageId: 'one');
      await Future<void>.delayed(Duration.zero);
      expect(opened, isEmpty);
      nav.markReady();
      await Future<void>.delayed(Duration.zero);
      expect(
        opened.single.toString(),
        'https://fromlog.caadiq.co.kr/admin/schedule/queue',
      );
      nav.receive({'type': 'schedule_queue'}, messageId: 'one');
      await Future<void>.delayed(Duration.zero);
      expect(opened.length, 1);
      nav.receive({'kind': 'ops', 'botId': '2'}, messageId: 'two');
      await Future<void>.delayed(Duration.zero);
      expect(opened.last.path, '/admin/schedule/bots');
      expect(pushDestination({'url': 'https://untrusted.test/'}), isNull);
    },
  );
}
