import 'dart:async';

/// Resolve known notification types only. Payload URLs never control navigation.
Uri? pushDestination(Map<String, dynamic> data) {
  final String path;
  if (data['type'] == 'schedule_queue') {
    path = '/admin/schedule/queue';
  } else if (data['botId'] != null) {
    path = '/admin/schedule/bots';
  } else if (data['kind'] == 'ops') {
    path = '/admin/logs';
  } else {
    return null;
  }
  return Uri.https('fromlog.caadiq.co.kr', path);
}

/// Defer cold-start taps until the update gate has completed; deduplicate delivery.
class PushNavigation {
  PushNavigation({required this.open});
  final Future<bool> Function(Uri uri) open;
  bool _ready = false;
  bool _opening = false;
  final _seen = <String>{};
  final _pending = <({String? id, Uri uri})>[];

  void receive(Map<String, dynamic> data, {String? messageId}) {
    final uri = pushDestination(data);
    if (uri == null || (messageId != null && _seen.contains(messageId))) return;
    if (messageId != null) {
      _seen.add(messageId);
      if (_seen.length > 50) _seen.remove(_seen.first);
    }
    _pending.add((id: messageId, uri: uri));
    if (_pending.length > 10) _pending.removeAt(0);
    unawaited(_drain());
  }

  void markReady() {
    _ready = true;
    unawaited(_drain());
  }

  Future<void> _drain() async {
    if (!_ready || _opening) return;
    _opening = true;
    try {
      while (_pending.isNotEmpty) {
        final target = _pending.removeAt(0);
        try {
          if (!await open(target.uri)) _seen.remove(target.id);
        } catch (_) {
          _seen.remove(target.id);
        }
      }
    } finally {
      _opening = false;
    }
  }
}
