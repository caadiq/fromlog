import 'package:flutter_test/flutter_test.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:fromis9/widgets/youtube/youtube_links.dart';

void main() {
  test('title, watch-on-YouTube and channel links leave the player', () {
    for (final url in [
      'https://www.youtube.com/watch?v=Am4EJN0uF3Q&feature=emb_title',
      'https://m.youtube.com/watch?v=Am4EJN0uF3Q&t=30',
      'https://youtu.be/Am4EJN0uF3Q',
      'https://www.youtube.com/@LG',
      'https://www.youtube.com/channel/UC123',
      'https://www.youtube.com/shorts/Am4EJN0uF3Q',
      'youtube://www.youtube.com/watch?v=Am4EJN0uF3Q',
      'intent://www.youtube.com/watch?v=Am4EJN0uF3Q#Intent;scheme=https;end',
      'vnd.youtube:Am4EJN0uF3Q',
    ]) {
      expect(youtubeViewerLink(url)?.scheme, 'https', reason: url);
    }
    expect(
      youtubeViewerLink(
        'https://m.youtube.com/watch?v=Am4EJN0uF3Q&t=30',
      )?.queryParameters['t'],
      '30',
    );
  });

  test(
    'initial HTML, iframe, playback resources and unrelated hosts stay in WebView',
    () {
      for (final url in [
        'about:blank',
        'https://www.youtube-nocookie.com',
        'https://www.youtube-nocookie.com/embed/?enablejsapi=1',
        'https://www.youtube.com/embed/Am4EJN0uF3Q',
        'https://www.youtube.com/iframe_api',
        'https://www.youtube.com/youtubei/v1/player',
        'https://www.google.com/recaptcha/api2/anchor',
        'https://youtube.com.evil.example/watch?v=Am4EJN0uF3Q',
      ]) {
        expect(youtubeViewerLink(url), isNull, reason: url);
      }
    },
  );

  test('installed app is preferred without launching a browser', () async {
    final modes = <LaunchMode>[];
    expect(
      await openYoutubeViewerLink(
        Uri.parse('https://www.youtube.com/watch?v=Am4EJN0uF3Q'),
        launcher: (uri, mode) async {
          modes.add(mode);
          return true;
        },
      ),
      isTrue,
    );
    expect(modes, [LaunchMode.externalNonBrowserApplication]);
  });

  for (final throws in [false, true]) {
    test('missing app falls back externally (throws=$throws)', () async {
      final modes = <LaunchMode>[];
      final opened = await openYoutubeViewerLink(
        Uri.parse('https://www.youtube.com/watch?v=Am4EJN0uF3Q'),
        launcher: (uri, mode) async {
          modes.add(mode);
          if (mode == LaunchMode.externalNonBrowserApplication) {
            if (throws) throw Exception('No app installed');
            return false;
          }
          return true;
        },
      );
      expect(opened, isTrue);
      expect(modes, [
        LaunchMode.externalNonBrowserApplication,
        LaunchMode.externalApplication,
      ]);
    });
  }

  test(
    'failed external launch is reported without a WebView fallback',
    () async {
      expect(
        await openYoutubeViewerLink(
          Uri.parse('https://www.youtube.com/watch?v=Am4EJN0uF3Q'),
          launcher: (_, _) async => false,
        ),
        isFalse,
      );
    },
  );
}
