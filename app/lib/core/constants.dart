/// 앱 전역 상수 정의
library;

import 'package:flutter/material.dart';

/// API 기본 URL
const String apiBaseUrl = 'https://fromlog.caadiq.co.kr/api';

/// 일정 카테고리 ID (백엔드 config/index.js CATEGORY_IDS와 동일)
class CategoryId {
  static const int youtube = 2;
  static const int x = 3;
  static const int comeback = 4;
  static const int fansign = 5;
  static const int concert = 6;
  static const int ticket = 7;
  static const int birthday = 8;
  static const int anniversary = 9;
  static const int variety = 10;
  static const int event = 11;
  static const int album = 17;
}

/// 목록 상단에 항상 노출되는 카테고리 (컴백·앨범) — 웹 FEATURED_CATEGORY_IDS
const List<int> kFeaturedCategoryIds = [CategoryId.comeback, CategoryId.album];

/// 에디토리얼 리뉴얼 토큰 (웹 tailwind.config.js와 동일)
class EColors {
  static const Color ink = Color(0xFF141613); // 제목·선택 블록·잉크 버튼
  static const Color paper = Color(0xFFFBFBF9); // 페이지 배경
  static const Color ebody = Color(0xFF3D423E); // 본문
  static const Color esub = Color(0xFF71756D); // 보조 본문
  static const Color mute = Color(0xFF9B9E96); // 라벨·캡션
  static const Color faint = Color(0xFFC6C8C0); // 번호·비활성
  static const Color faintLight = Color(0xFFD8DAD2); // 워터마크·점선
  static const Color hairline = Color(0xFFE8E8E3); // 구분선·보더
  static const Color greenSoft = Color(0xFFEDF5EF); // 멤버 칩 배경
  static const Color greenDeep = Color(0xFF3E6348); // 멤버 칩 텍스트
  static const Color calSun = Color(0xFFD08585);
  static const Color calSat = Color(0xFF8598C8);
  static const Color canvas = Color(0xFFF6F7F4); // 커버 지면
  static const Color canvasDeep = Color(0xFFEFF1ED); // 지도 프리뷰
  static const Color green = Color(0xFF548360); // primary와 동일 (에디토리얼 그린)
  static const Color navInactive = Color(0xFFB9BCB3); // 하단 내비 비활성
}

/// 동적 테마 팔레트 — 런타임에 `/api/theme`에서 받아 교체 (loadPalette)
class Palette {
  final Color primary; // 버튼·링크·활성 (웹 --c-primary)
  final Color soft; // 멤버 칩 배경 (--c-primary-soft)
  final Color deep; // 멤버 칩 텍스트·강조 (--c-primary-deep)

  const Palette({required this.primary, required this.soft, required this.deep});
}

/// 현재 적용 중인 팔레트 (기본: 브랜드 그린). `main()`에서 loadPalette로 갱신.
Palette appPalette = const Palette(
  primary: EColors.green,
  soft: EColors.greenSoft,
  deep: EColors.greenDeep,
);

/// 공식 소셜 링크 (웹 SOCIAL_LINKS와 동일)
class SocialLinks {
  static const String youtube = 'https://www.youtube.com/@fromis9_official';
  static const String instagram = 'https://www.instagram.com/officialfromis_9';
  static const String x = 'https://twitter.com/realfromis_9';
}
