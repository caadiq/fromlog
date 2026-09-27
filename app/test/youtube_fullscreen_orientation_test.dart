import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fromis9/widgets/youtube/fullscreen_playback_recovery.dart';
import 'package:fromis9/widgets/youtube/youtube_fullscreen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final calls = <MethodCall>[];

  setUp(() {
    calls.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
          calls.add(call);
          return null;
        });
  });
  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null);
  });

  List<dynamic> getOrientations() => calls
      .where((call) => call.method == 'SystemChrome.setPreferredOrientations')
      .map((call) => call.arguments)
      .toList();

  for (final action in ['none', 'touch', 'background', 'hide', 'back']) {
    testWidgets('playback recovery waits for rotation and respects $action', (
      tester,
    ) async {
      final navigator = GlobalKey<NavigatorState>();
      final fullscreen = YoutubeFullscreenSession();
      var reads = 0;
      var resumes = 0;
      final recovery = FullscreenPlaybackRecovery(
        wasPlaying: true,
        readState: () async {
          reads++;
          return 2;
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
      expect(reads, 0);
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
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pump();
      expect(resumes, action == 'none' ? 1 : 0);
      expect(reads, action == 'none' ? 1 : 0);
      fullscreen.hide();
      await tester.pumpAndSettle();
      await done;
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
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
      rotation.complete();
      await tester.pump(const Duration(seconds: 1));
      expect(getOrientations().last, ['DeviceOrientation.portraitUp']);
      final modes = calls.where(
        (c) => c.method == 'SystemChrome.setEnabledSystemUIMode',
      );
      expect(modes.last.arguments, 'SystemUiMode.edgeToEdge');
      expect(
        modes.any((c) => c.arguments == 'SystemUiMode.immersiveSticky'),
        isFalse,
      );
      expect(tester.takeException(), isNull);
    },
  );
}
