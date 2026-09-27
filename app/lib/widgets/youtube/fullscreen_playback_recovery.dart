import 'dart:async';

/// Restore only playback interrupted by the short native fullscreen transition.
/// The owner cancels this on user input, backgrounding, closing or replacement.
class FullscreenPlaybackRecovery {
  FullscreenPlaybackRecovery({
    required this.wasPlaying,
    required this.readState,
    required this.resumeIfPaused,
  });

  final bool wasPlaying;
  final Future<int?> Function() readState;
  final Future<void> Function() resumeIfPaused;
  Timer? _poll;
  Timer? _deadline;
  bool _started = false;
  bool _cancelled = false;

  void start() {
    if (_started || _cancelled) return;
    _started = true;
    if (!wasPlaying) return;
    // Native view attachment and orientation callbacks can complete separately.
    // Observe briefly after layout settles; never become a permanent auto-play loop.
    _deadline = Timer(const Duration(seconds: 2), cancel);
    _poll = Timer(Duration.zero, _check);
  }

  Future<void> _check() async {
    if (_cancelled) return;
    try {
      final state = await readState().timeout(const Duration(seconds: 1));
      if (_cancelled) return;
      if (state == 2) {
        await resumeIfPaused();
        cancel();
      } else if (state == 1 || state == 3) {
        // Playing/buffering may be followed by a pause during native resizing.
        _poll = Timer(const Duration(milliseconds: 200), _check);
      } else {
        // Ended, unstarted, cued or missing players must not be restarted.
        cancel();
      }
    } catch (_) {
      // A closing WebView or failed bridge must not leave a retry timer behind.
      cancel();
    }
  }

  void cancel() {
    _cancelled = true;
    _poll?.cancel();
    _deadline?.cancel();
  }
}
