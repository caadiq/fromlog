/// 응원법 진행 계산 검증.
///
/// 실제로 등록된 응원법(하얀 그리움 · LIKE YOU BETTER)을 그대로 넣고,
/// 웹에서 확인한 것과 같은 시점에서 같은 결과가 나오는지 본다.
library;

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:fromis9/core/fanchant_progress.dart';
import 'package:fromis9/models/fanchant.dart';

Fanchant load(String name) => Fanchant.fromJson(
  jsonDecode(File('test/fixtures/$name.json').readAsStringSync())
      as Map<String, dynamic>,
);

void main() {
  late Fanchant white; // 하얀 그리움
  late Fanchant lyb; // LIKE YOU BETTER
  late FanchantProgress pWhite;
  late FanchantProgress pLyb;

  setUpAll(() {
    white = load('fanchant_137');
    lyb = load('fanchant_144');
    pWhite = FanchantProgress(white.lines);
    pLyb = FanchantProgress(lyb.lines);
  });

  /// 그 시점에 진하게 칠해지는 조각들의 글자
  List<String> shown(FanchantProgress p, Fanchant f, double time) {
    final frame = p.frameAt(time);
    final out = <String>[];
    for (final i in frame.active.toList()..sort()) {
      final piece = p.flat[i];
      out.add(f.lines[piece.li].parts[piece.pi].text.trim());
    }
    return out;
  }

  /// 그 시점에 배경이 들어가는 응원법
  String? callText(FanchantProgress p, Fanchant f, double time) {
    final c = p.frameAt(time).call;
    if (c == null) return null;
    return f.lines[c.li].parts[c.pi].text.trim();
  }

  group('겹쳐 흐르는 자리', () {
    test('같은 시각에 시작하면 가사와 응원법이 함께 켜진다', () {
      // 77.96s ~ 79.91s — "겨울에 난"과 "(겨.울.에.난)"이 같은 시각
      expect(shown(pWhite, white, 78.5), ['겨울에 난', '(겨.울.에.난)']);
      expect(callText(pWhite, white, 78.5), '(겨.울.에.난)');
    });

    test('유지 블록에서 응원법이 뒤에 있어도 가사가 꺼지지 않는다', () {
      // 38.63s 가사 → 40.76s 응원법. 흩어져를 부르는 동안 프로미스나인을 외친다
      expect(shown(pWhite, white, 39.5), ['그댄 눈물로 흩어져']);
      expect(shown(pWhite, white, 41.5), ['그댄 눈물로 흩어져', '(프로미스나인)']);
      expect(callText(pWhite, white, 41.5), '(프로미스나인)');
    });

    test('유지 블록이 끝나면 응원법도 꺼진다', () {
      expect(shown(pWhite, white, 43.5), ['기억해요']);
      expect(callText(pWhite, white, 43.5), isNull);
    });

    test('줄 중간 콜은 종전대로 하나씩 넘어간다', () {
      // from(64.7) → summer days(65.16) → to the(66.53)
      expect(shown(pLyb, lyb, 64.9), ['from']);
      expect(shown(pLyb, lyb, 65.8), ['summer days']);
      expect(shown(pLyb, lyb, 66.9), ['to the']);
    });
  });

  group('왼쪽 세로 바', () {
    /// 바가 그려지는 줄의 글자
    List<String> bars(FanchantProgress p, Fanchant f, double time) {
      final ls = p.frameAt(time).lines.toList()..sort();
      return ls
          .map((li) => f.lines[li].parts.map((x) => x.text).join().trim())
          .toList();
    }

    test('유지 블록에서는 응원법 줄과 가사 줄에 함께 선다', () {
      // 응원법이 앞인 블록
      expect(bars(pWhite, white, 28.5), ['(함성)', '하얀 눈이 내려와']);
      // 응원법이 뒤인 블록
      expect(bars(pWhite, white, 41.5), ['그댄 눈물로 흩어져', '(프로미스나인)']);
    });

    test('블록 밖에서는 한 줄만', () {
      expect(bars(pWhite, white, 44.5).length, 1);
    });

    test('블록 안 가사가 여러 줄이면 흐르는 내내 응원법 줄이 남는다', () {
      // 42.31 응원법 + 가사 4줄(~47.38)
      for (final t in [43.0, 45.0, 47.9]) {
        final b = bars(pLyb, lyb, t);
        expect(b.length, 2, reason: '$t초');
        expect(b.first, contains('(함성)'));
      }
      // 블록이 끝나면 하나로 돌아온다
      expect(bars(pLyb, lyb, 52.0).length, 1);
    });
  });

  group('구조', () {
    test('빈 줄로 문단이 나뉜다', () {
      expect(pWhite.paragraphs, isNotEmpty);
      for (final r in pWhite.paragraphs) {
        expect(white.lines[r[0]].gap, isFalse);
        expect(white.lines[r[1]].gap, isFalse);
      }
    });

    test('재생 전에는 아무것도 켜지 않는다', () {
      final frame = pWhite.frameAt(0);
      expect(frame.cur, -1);
      expect(frame.active, isEmpty);
      expect(frame.call, isNull);
    });

    test('색은 앨범에서 뽑은 두 색을 쓴다', () {
      expect(white.callColor, isNot(white.singColor));
    });
  });
}
