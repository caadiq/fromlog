/// Repair only a clear reset to the beginning during native fullscreen entry.
/// Recheck state and time in the same JS task to avoid seeking normal playback.
String fullscreenPositionRepairScript(Duration before) =>
    '''
(function () {
  if (!player || !player.getPlayerState || !player.getCurrentTime) return false;
  var state = player.getPlayerState();
  var current = player.getCurrentTime();
  var before = ${before.inMilliseconds / 1000};
  if ((state === 1 || state === 2 || state === 3) &&
      before >= 0.75 && Number.isFinite(current) && current >= 0 &&
      current <= 0.75 && before - current >= 0.5) {
    player.seekTo(before, true);
    return true;
  }
  return false;
})()
''';
