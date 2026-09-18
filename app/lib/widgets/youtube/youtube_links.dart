import 'package:url_launcher/url_launcher.dart';

/// Only viewer destinations leave the player. Embed/API/resource URLs stay put.
Uri? youtubeViewerLink(String url) {
  final uri = Uri.tryParse(url);
  if (uri == null) return null;
  if (uri.scheme == 'vnd.youtube') {
    final id = uri.host.isNotEmpty ? uri.host : uri.path;
    if (!RegExp(r'^[\w-]{11}$').hasMatch(id)) return null;
    return Uri.https('www.youtube.com', '/watch', {'v': id});
  }
  if (!['https', 'http', 'youtube', 'intent'].contains(uri.scheme)) {
    return null;
  }
  final host = uri.host.toLowerCase();
  if (host == 'youtu.be') {
    return uri.replace(scheme: 'https', fragment: '');
  }
  if (host != 'youtube.com' && !host.endsWith('.youtube.com')) return null;
  final path = uri.path;
  final viewer =
      path == '/watch' ||
      path.startsWith('/shorts/') ||
      path.startsWith('/live/') ||
      path.startsWith('/channel/') ||
      path.startsWith('/c/') ||
      path.startsWith('/user/') ||
      path.startsWith('/@') ||
      path == '/playlist';
  if (!viewer) return null;
  return uri.replace(scheme: 'https', host: 'www.youtube.com', fragment: '');
}

typedef YoutubeUrlLauncher = Future<bool> Function(Uri uri, LaunchMode mode);

Future<bool> _launch(Uri uri, LaunchMode mode) => launchUrl(uri, mode: mode);

/// Prefer the installed app; if unavailable, use the system browser, never WebView.
Future<bool> openYoutubeViewerLink(
  Uri uri, {
  YoutubeUrlLauncher launcher = _launch,
}) async {
  for (final mode in [
    LaunchMode.externalNonBrowserApplication,
    LaunchMode.externalApplication,
  ]) {
    try {
      if (await launcher(uri, mode)) return true;
    } catch (_) {
      // Platform implementations can throw when no application can handle a URL.
    }
  }
  return false;
}
