import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:fromis9/widgets/youtube/youtube_player_controller.dart';

void main() {
  test('video IDs remain data in both JavaScript and HTML script contexts', () {
    for (final value in [
      'Am4EJN0uF3Q',
      "');alert(1);//",
      '</script><script>alert(1)</script>',
      '<!--',
      'quote" and slash\\ and newline\n',
    ]) {
      final encoded = youtubeScriptString(value);
      expect(encoded, isNot(contains('<')));
      expect(jsonDecode(encoded), value);
      expect(encoded.startsWith('"') && encoded.endsWith('"'), isTrue);
    }
  });
}
