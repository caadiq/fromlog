import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:fromis9/widgets/youtube/fullscreen_playback_recovery.dart';

void main() {
  testWidgets('repairs a reset after resume without issuing play twice', (
    tester,
  ) async {
    var plays = 0;
    var repairs = 0;
    var repairChecks = 0;
    var reset = false;
    var state = 2;
    final recovery = FullscreenPlaybackRecovery(
      wasPlaying: true,
      readState: () async => state,
      resumeIfPaused: () async {
        plays++;
        state = 1;
      },
      repairPositionIfReset: () async {
        repairChecks++;
        if (!reset) return false;
        repairs++;
        return true;
      },
    );
    recovery.start();
    await tester.pump(const Duration(milliseconds: 1));
    expect(plays, 1);
    expect(repairs, 0);
    reset = true;
    await tester.pump(const Duration(milliseconds: 50));
    expect(repairs, 1);
    final checks = repairChecks;
    state = 2;
    await tester.pump(const Duration(seconds: 3));
    expect(plays, 1);
    expect(repairs, 1);
    expect(repairChecks, checks);
  });

  testWidgets('cancel during position query prevents subsequent auto-play', (
    tester,
  ) async {
    final repaired = Completer<bool>();
    var plays = 0;
    final recovery = FullscreenPlaybackRecovery(
      wasPlaying: true,
      readState: () async => 2,
      repairPositionIfReset: () => repaired.future,
      resumeIfPaused: () async {
        plays++;
      },
    );
    recovery.start();
    await tester.pump(const Duration(milliseconds: 1));
    recovery.cancel();
    repaired.complete(false);
    await tester.pump(const Duration(milliseconds: 1));
    expect(plays, 0);
  });

  testWidgets(
    'resumes a transition pause once without restarting later pauses',
    (tester) async {
      var resumes = 0;
      final recovery = FullscreenPlaybackRecovery(
        wasPlaying: true,
        readState: () async => 2,
        resumeIfPaused: () async {
          resumes++;
        },
      );
      recovery.start();
      await tester.pump(const Duration(milliseconds: 1));
      expect(resumes, 1);
      recovery.start();
      await tester.pump(const Duration(seconds: 3));
      expect(resumes, 1);
    },
  );

  for (final state in [1, 3]) {
    testWidgets('observes state $state until a delayed native pause', (
      tester,
    ) async {
      var current = state;
      var resumes = 0;
      final recovery = FullscreenPlaybackRecovery(
        wasPlaying: true,
        readState: () async => current,
        resumeIfPaused: () async {
          resumes++;
        },
      );
      recovery.start();
      await tester.pump(const Duration(milliseconds: 1));
      expect(resumes, 0);
      current = 2;
      await tester.pump(const Duration(milliseconds: 200));
      expect(resumes, 1);
    });
  }

  testWidgets('paused entry never queries or starts playback', (tester) async {
    var calls = 0;
    FullscreenPlaybackRecovery(
      wasPlaying: false,
      readState: () async {
        calls++;
        return 2;
      },
      resumeIfPaused: () async {
        calls++;
      },
    ).start();
    await tester.pump(const Duration(seconds: 3));
    expect(calls, 0);
  });

  for (final state in <int?>[-1, 0, 5, null]) {
    testWidgets('state $state is not restarted', (tester) async {
      var resumes = 0;
      FullscreenPlaybackRecovery(
        wasPlaying: true,
        readState: () async => state,
        resumeIfPaused: () async {
          resumes++;
        },
      ).start();
      await tester.pump(const Duration(milliseconds: 1));
      await tester.pump(const Duration(seconds: 3));
      expect(resumes, 0);
    });
  }

  testWidgets('cancellation ignores an outstanding state query', (
    tester,
  ) async {
    final state = Completer<int?>();
    var resumes = 0;
    final recovery = FullscreenPlaybackRecovery(
      wasPlaying: true,
      readState: () => state.future,
      resumeIfPaused: () async {
        resumes++;
      },
    );
    recovery.start();
    await tester.pump(const Duration(milliseconds: 1));
    recovery.cancel();
    state.complete(2);
    await tester.pump(const Duration(milliseconds: 1));
    expect(resumes, 0);
  });

  testWidgets('deadline ends observation even if playback continues', (
    tester,
  ) async {
    var reads = 0;
    FullscreenPlaybackRecovery(
      wasPlaying: true,
      readState: () async {
        reads++;
        return 1;
      },
      resumeIfPaused: () async {
        fail('must not resume');
      },
    ).start();
    await tester.pump(const Duration(milliseconds: 1));
    for (var i = 0; i < 12; i++) {
      await tester.pump(const Duration(milliseconds: 200));
    }
    final count = reads;
    await tester.pump(const Duration(seconds: 3));
    expect(reads, count);
    expect(count, lessThanOrEqualTo(40));
  });

  testWidgets('bridge timeout ignores late pause response', (tester) async {
    final state = Completer<int?>();
    FullscreenPlaybackRecovery(
      wasPlaying: true,
      readState: () => state.future,
      resumeIfPaused: () async {
        fail('late response must not resume');
      },
    ).start();
    await tester.pump(const Duration(milliseconds: 1));
    await tester.pump(const Duration(seconds: 1));
    state.complete(2);
    await tester.pump(const Duration(milliseconds: 1));
    expect(tester.takeException(), isNull);
  });

  testWidgets('bridge failure stops without uncaught errors or retries', (
    tester,
  ) async {
    var reads = 0;
    FullscreenPlaybackRecovery(
      wasPlaying: true,
      readState: () async {
        reads++;
        throw StateError('closed');
      },
      resumeIfPaused: () async {
        fail('must not resume');
      },
    ).start();
    await tester.pump(const Duration(milliseconds: 1));
    await tester.pump(const Duration(seconds: 3));
    expect(reads, 1);
    expect(tester.takeException(), isNull);
  });
}
