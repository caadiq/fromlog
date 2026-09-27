import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
// Exercise native media lifecycle without network or an Android decoder.
// ignore: depend_on_referenced_packages
import 'package:video_player_platform_interface/video_player_platform_interface.dart';
import 'package:fromis9/models/album.dart';
import 'package:fromis9/widgets/teaser_viewer.dart';

class RecordingVideoPlatform extends VideoPlayerPlatform {
  int next = 0;
  bool fail = false;
  final streams = <int, StreamController<VideoEvent>>{};
  final disposed = <int>[];
  final played = <int>[];
  @override
  Future<void> init() async {}
  @override
  Future<int?> createWithOptions(VideoCreationOptions options) async {
    final id = next++;
    final stream = streams[id] = StreamController<VideoEvent>();
    if (fail) {
      stream.addError(
        PlatformException(code: 'load-error', message: 'Could not load'),
      );
    } else {
      stream.add(
        VideoEvent(
          eventType: VideoEventType.initialized,
          duration: const Duration(minutes: 1),
          size: const Size(640, 360),
        ),
      );
    }
    return id;
  }

  @override
  Stream<VideoEvent> videoEventsFor(int id) => streams[id]!.stream;
  @override
  Future<void> dispose(int id) async {
    disposed.add(id);
    await streams[id]?.close();
  }

  @override
  Future<void> play(int id) async {
    played.add(id);
  }

  @override
  Future<void> pause(int id) async {}
  @override
  Future<void> setLooping(int id, bool looping) async {}
  @override
  Future<void> setVolume(int id, double volume) async {}
  @override
  Future<void> setPlaybackSpeed(int id, double speed) async {}
  @override
  Future<void> seekTo(int id, Duration position) async {}
  @override
  Future<Duration> getPosition(int id) async => Duration.zero;
  @override
  Future<void> setMixWithOthers(bool mix) async {}
  @override
  Widget buildView(int id) => const ColoredBox(color: Colors.black);
}

void main() {
  late VideoPlayerPlatform original;
  late RecordingVideoPlatform platform;
  setUp(() {
    original = VideoPlayerPlatform.instance;
    platform = RecordingVideoPlatform();
    VideoPlayerPlatform.instance = platform;
  });
  tearDown(() => VideoPlayerPlatform.instance = original);
  Future<void> flush(WidgetTester tester) async {
    await tester.runAsync(() async {
      await Future<void>.delayed(Duration.zero);
    });
    for (var i = 0; i < 15; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  final teasers = [
    Teaser(id: 1, videoUrl: 'https://example.test/one.mp4', mediaType: 'video'),
    Teaser(id: 2, videoUrl: 'https://example.test/two.mp4', mediaType: 'video'),
  ];
  testWidgets('only visible teaser owns a player and leaving disposes it', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(home: TeaserViewer(teasers: teasers, initialIndex: 0)),
    );
    await flush(tester);
    expect(platform.next, 1);
    expect(platform.played, contains(0));
    await tester.drag(find.byType(PageView), const Offset(-750, 0));
    await flush(tester);
    expect(platform.next, 2);
    await tester.runAsync(() async {
      await Future<void>.delayed(Duration.zero);
    });
    expect(platform.disposed, contains(0));
    await tester.pumpWidget(const SizedBox());
    await flush(tester);
    await tester.runAsync(() async {
      await Future<void>.delayed(Duration.zero);
    });
    expect(platform.disposed, contains(1));
    expect(tester.takeException(), isNull);
  });
  testWidgets('failed teaser can retry without retaining the failed player', (
    tester,
  ) async {
    platform.fail = true;
    await tester.pumpWidget(
      MaterialApp(home: TeaserViewer(teasers: teasers, initialIndex: 0)),
    );
    await flush(tester);
    expect(find.text('다시 시도'), findsOneWidget);
    platform.fail = false;
    await tester.tap(find.text('다시 시도'));
    await flush(tester);
    await tester.runAsync(() async {
      await Future<void>.delayed(Duration.zero);
    });
    expect(platform.disposed, contains(0));
    expect(platform.played, contains(1));
    await tester.pumpWidget(const SizedBox());
    await flush(tester);
    expect(tester.takeException(), isNull);
  });
}
