/// 안내 일정 판정 — 📢 이모지와 [공지] 태그.
///
/// 소스 계정은 글머리에 표식을 붙인다([💌]·[📺]·[💡]·[📢]·[공지]).
/// 그중 팬이 행동해야 하는 것만 색을 입히는데, [공지]가 빠져 있어
/// "[공지] 프로미스나인 박지원 스케줄 불참 안내"가 평범한 글로 보였다.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:fromis9/core/format_utils.dart';
import 'package:fromis9/core/constants.dart';

void main() {
  bool notice(String title, {int categoryId = CategoryId.x}) =>
      isNoticeSchedule(categoryId: categoryId, title: title);

  test('[공지] 태그가 붙으면 안내다', () {
    expect(notice('[공지] 프로미스나인 박지원 스케줄 불참 안내'), isTrue);
    expect(notice('[공지] ‘2025 원주 K-POP 페스티벌’ 관련 안내'), isTrue);
  });

  test('📢는 위치와 무관하게 안내다', () {
    expect(notice('[📢] 인원 체크 시간이 수정되었습니다.'), isTrue);
    expect(notice('📢 대괄호 없이'), isTrue);
    expect(notice('MD NOTICE 📢'), isTrue);
  });

  test('본문에 스쳐 나오는 "공지"만으로는 안내가 아니다', () {
    // 태그가 아니라 문장 속 낱말 — 이것까지 물들이면 평범한 글이 강조된다
    expect(notice('[🔈] 발매기념 FAN SIGN 이벤트 공지'), isFalse);
    expect(notice('공지사항 확인 부탁드립니다'), isFalse);
  });

  test('X가 아닌 카테고리는 제목이 뭐든 안내가 아니다', () {
    expect(notice('[공지] 무언가', categoryId: CategoryId.youtube), isFalse);
    expect(notice('[📢] 무언가', categoryId: CategoryId.concert), isFalse);
  });
}
