import 'dart:async';

/// Restore only playback interrupted by the short native fullscreen transition.
/// The owner cancels this on user input, backgrounding, closing or replacement.
class FullscreenPlaybackRecovery {
  FullscreenPlaybackRecovery({
    required this.wasPlaying,
    required this.readState,
    required this.resumeIfPaused,
    this.repairPositionIfReset,
  });

  final bool wasPlaying;
  final Future<int?> Function() readState;
  final Future<void> Function() resumeIfPaused;
  final Future<bool> Function()? repairPositionIfReset;
  Timer? _poll;
  Timer? _deadline;
  bool _started = false;
  bool _cancelled = false;
  bool _resumed = false;
  bool _positionRepaired = false;

  void start() {
    if (_started || _cancelled) return;
    _started = true;
    if (!wasPlaying) return;
    // Native view attachment and orientation callbacks can complete separately.
    // Observe briefly from the first fullscreen frame; never become a permanent auto-play loop.
    _deadline = Timer(const Duration(seconds: 2), cancel);
    _poll = Timer(Duration.zero, _check);
  }

  Future<void> _check() async {
    if (_cancelled) return;
    try {
      final state = await readState().timeout(const Duration(seconds: 1));
      if (_cancelled) return;
      if (state != 1 && state != 2 && state != 3) {
        cancel();
        return;
      }
      if (!_positionRepaired && repairPositionIfReset != null) {
        _positionRepaired = await repairPositionIfReset!().timeout(
          const Duration(seconds: 1),
        );
        if (_cancelled) return;
      }
      if (state == 2 && !_resumed) {
        _resumed = true;
        await resumeIfPaused();
        if (repairPositionIfReset == null) cancel();
      }
      // A native reset may become visible just after playback resumes.
      // Continue observing position, but never issue a second play command.
      if (!_cancelled) {
        _poll = Timer(const Duration(milliseconds: 50), _check);
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
