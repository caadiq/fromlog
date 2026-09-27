import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fromis9/widgets/youtube/fullscreen_playback_recovery.dart';
import 'package:fromis9/widgets/youtube/youtube_fullscreen.dart';

void main() {
  final binding = TestWidgetsFlutterBinding.ensureInitialized();
  final calls = <MethodCall>[];

  setUp(() {
    calls.clear();
    binding.platformDispatcher.views.single.physicalSize = const Size(
      600,
      1000,
    );
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
          calls.add(call);
          return null;
        });
  });
  tearDown(() {
    binding.platformDispatcher.views.single.resetPhysicalSize();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null);
  });

  List<dynamic> getOrientations() => calls
      .where((call) => call.method == 'SystemChrome.setPreferredOrientations')
      .map((call) => call.arguments)
      .toList();

  testWidgets('exit covers landscape detail until portrait layout is ready', (
    tester,
  ) async {
    final navigator = GlobalKey<NavigatorState>();
    final fullscreen = YoutubeFullscreenSession();
    var nativeExit = 0;
    await tester.pumpWidget(
      MaterialApp(
        navigatorKey: navigator,
        home: const Scaffold(body: Text('detail toolbar')),
      ),
    );
    final done = fullscreen.show(
      navigator: navigator.currentState!,
      content: const Text('native video'),
      aspectRatio: 16 / 9,
      onFlutterExit: () => nativeExit++,
    );
    await tester.pumpAndSettle();
    tester.view.physicalSize = const Size(1000, 600);
    await tester.pumpAndSettle();
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.byType(YoutubeFullScreen), findsOneWidget);
    expect(nativeExit, 0);
    expect(getOrientations().last, ['DeviceOrientation.portraitUp']);
    expect(
      calls.where((c) => c.arguments == 'SystemUiMode.edgeToEdge'),
      isEmpty,
    );
    // Repeated Back must stay inside the transition, not pop the detail page.
    await tester.binding.handlePopRoute();
    tester.view.physicalSize = const Size(600, 1000);
    await tester.pumpAndSettle();
    await done;
    expect(nativeExit, 1);
    expect(find.byType(YoutubeFullScreen), findsNothing);
    expect(find.text('detail toolbar'), findsOneWidget);
    expect(calls.last.arguments, 'SystemUiMode.edgeToEdge');
  });

  testWidgets('ignored rotation has a bounded exit fallback', (tester) async {
    final navigator = GlobalKey<NavigatorState>();
    final fullscreen = YoutubeFullscreenSession();
    await tester.pumpWidget(
      MaterialApp(
        navigatorKey: navigator,
        home: const Scaffold(body: Text('detail')),
      ),
    );
    final done = fullscreen.show(
      navigator: navigator.currentState!,
      content: const Text('video'),
      aspectRatio: 16 / 9,
      onFlutterExit: () {},
    );
    await tester.pumpAndSettle();
    tester.view.physicalSize = const Size(1000, 600);
    await tester.pumpAndSettle();
    fullscreen.hide();
    await tester.pumpAndSettle();
    expect(find.byType(YoutubeFullScreen), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 1300));
    await tester.pumpAndSettle();
    await done;
    expect(find.byType(YoutubeFullScreen), findsNothing);
  });

  for (final action in ['none', 'touch', 'background', 'hide', 'back']) {
    testWidgets('playback recovery starts promptly and respects $action', (
      tester,
    ) async {
      final navigator = GlobalKey<NavigatorState>();
      final fullscreen = YoutubeFullscreenSession();
      var reads = 0;
      var resumes = 0;
      final sample = Completer<int?>();
      final recovery = FullscreenPlaybackRecovery(
        wasPlaying: true,
        readState: () async {
          reads++;
          return sample.future;
        },
        resumeIfPaused: () async {
          resumes++;
        },
      );
      await tester.pumpWidget(
        MaterialApp(
          navigatorKey: navigator,
          home: const Scaffold(body: Text('detail')),
        ),
      );
      final done = fullscreen.show(
        navigator: navigator.currentState!,
        content: const Center(child: Text('video')),
        aspectRatio: 16 / 9,
        onFlutterExit: () {},
        playbackRecovery: recovery,
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(reads, 1);
      switch (action) {
        case 'touch':
          await tester.tap(find.text('video'));
        case 'background':
          tester.binding.handleAppLifecycleStateChanged(
            AppLifecycleState.inactive,
          );
          tester.binding.handleAppLifecycleStateChanged(
            AppLifecycleState.paused,
          );
        case 'hide':
          fullscreen.hide();
        case 'back':
          await tester.binding.handlePopRoute();
      }
      sample.complete(2);
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pump();
      expect(resumes, action == 'none' ? 1 : 0);
      expect(reads, 1);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      fullscreen.hide();
      await tester.pumpAndSettle();
      await done;
    });
  }

  testWidgets(
    'fullscreen keeps source onstage, blocks taps and restores portrait',
    (tester) async {
      final navigator = GlobalKey<NavigatorState>();
      final fullscreen = YoutubeFullscreenSession();
      var detailTaps = 0;
      var nativeExit = 0;
      await tester.pumpWidget(
        MaterialApp(
          navigatorKey: navigator,
          home: Scaffold(
            body: Center(
              child: TextButton(
                onPressed: () => detailTaps++,
                child: const Text('source WebView location'),
              ),
            ),
          ),
        ),
      );
      for (var i = 0; i < 3; i++) {
        final done = fullscreen.show(
          navigator: navigator.currentState!,
          content: const Center(child: Text('fullscreen video')),
          aspectRatio: 16 / 9,
          onFlutterExit: () => nativeExit++,
        );
        await tester.pumpAndSettle();
        await tester.pump(const Duration(milliseconds: 500));
        // An opaque route offstages this subtree, hiding the Android source view.
        expect(find.text('source WebView location'), findsOneWidget);
        expect(getOrientations().last, [
          'DeviceOrientation.landscapeLeft',
          'DeviceOrientation.landscapeRight',
        ]);
        final state = tester.state<State<YoutubeFullScreen>>(
          find.byType(YoutubeFullScreen),
        );
        expect(ModalRoute.of(state.context)?.opaque, isFalse);
        await tester.tapAt(
          tester.getCenter(find.text('source WebView location')),
        );
        expect(detailTaps, 0);
        if (i == 1) {
          await tester.binding.handlePopRoute();
        } else {
          fullscreen.hide();
        }
        await tester.pumpAndSettle();
        await done;
        expect(getOrientations().last, ['DeviceOrientation.portraitUp']);
        expect(find.text('fullscreen video'), findsNothing);
        fullscreen.hide();
        await tester.pumpAndSettle();
        expect(find.text('source WebView location'), findsOneWidget);
      }
      expect(nativeExit, 1);
      await tester.tap(find.text('source WebView location'));
      expect(detailTaps, 1);
    },
  );

  testWidgets('vertical video keeps portrait during fullscreen and on exit', (
    tester,
  ) async {
    final navigator = GlobalKey<NavigatorState>();
    final fullscreen = YoutubeFullscreenSession();
    await tester.pumpWidget(
      MaterialApp(
        navigatorKey: navigator,
        home: const Scaffold(body: Text('detail')),
      ),
    );
    final done = fullscreen.show(
      navigator: navigator.currentState!,
      content: const Text('shorts'),
      aspectRatio: 9 / 16,
      onFlutterExit: () {},
    );
    await tester.pumpAndSettle();
    await tester.pump(const Duration(milliseconds: 500));
    expect(getOrientations().last, ['DeviceOrientation.portraitUp']);
    fullscreen.hide();
    await tester.pumpAndSettle();
    await done;
    expect(getOrientations(), everyElement(['DeviceOrientation.portraitUp']));
  });

  testWidgets(
    'late rotation completion cannot reapply fullscreen bars after exit',
    (tester) async {
      final rotation = Completer<void>();
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, (call) async {
            calls.add(call);
            if (call.method == 'SystemChrome.setPreferredOrientations' &&
                (call.arguments as List).contains(
                  'DeviceOrientation.landscapeLeft',
                )) {
              await rotation.future;
            }
            return null;
          });
      final navigator = GlobalKey<NavigatorState>();
      final fullscreen = YoutubeFullscreenSession();
      await tester.pumpWidget(
        MaterialApp(
          navigatorKey: navigator,
          home: const Scaffold(body: Text('detail')),
        ),
      );
      final done = fullscreen.show(
        navigator: navigator.currentState!,
        content: const Text('video'),
        aspectRatio: 16 / 9,
        onFlutterExit: () {},
      );
      await tester.pumpAndSettle();
      fullscreen.hide();
      await tester.pumpAndSettle();
      await done;
      final beforeLateRotation = modesCount(calls);
      rotation.complete();
      await tester.pump(const Duration(seconds: 1));
      expect(getOrientations().last, ['DeviceOrientation.portraitUp']);
      final modes = calls.where(
        (c) => c.method == 'SystemChrome.setEnabledSystemUIMode',
      );
      expect(modes.last.arguments, 'SystemUiMode.edgeToEdge');
      expect(modesCount(calls), beforeLateRotation);
      expect(tester.takeException(), isNull);
    },
  );
}

int modesCount(List<MethodCall> calls) => calls
    .where((c) => c.method == "SystemChrome.setEnabledSystemUIMode")
    .length;
