/// 응원법 모델 (웹 GET /fanchant/:trackId 응답 대응)
library;

import 'package:flutter/material.dart';

/// 줄 안의 한 조각 — 가사이거나 응원법(call·sing)이다.
class FanchantPart {
  final String text;

  /// 'call'(따로 외치기) · 'sing'(같이 부르기), 가사면 null
  final String? type;

  /// 이 조각이 시작하는 시각(초). 안 찍었으면 null
  final double? t;

  const FanchantPart({required this.text, this.type, this.t});

  bool get isCall => type != null;

  factory FanchantPart.fromJson(Map<String, dynamic> json) => FanchantPart(
    text: json['text'] as String? ?? '',
    type: json['type'] as String?,
    t: (json['t'] as num?)?.toDouble(),
  );
}

/// 가사 한 줄. 빈 줄(gap)은 문단 구분이다.
class FanchantLine {
  final bool gap;

  /// 유지 블록 번호 — 이 블록 안의 응원법은 블록이 끝날 때까지 강조가 남는다
  final int? hg;
  final double? t;
  final List<FanchantPart> parts;

  const FanchantLine({
    this.gap = false,
    this.hg,
    this.t,
    this.parts = const [],
  });

  factory FanchantLine.fromJson(Map<String, dynamic> json) => FanchantLine(
    gap: json['gap'] == true,
    hg: (json['hg'] as num?)?.toInt(),
    t: (json['t'] as num?)?.toDouble(),
    parts: (json['parts'] as List<dynamic>? ?? [])
        .map((p) => FanchantPart.fromJson(p as Map<String, dynamic>))
        .toList(),
  );
}

/// 응원법 영상 정보 (아카이브에 있으면 함께 온다)
class FanchantVideo {
  final String title;
  final String channelName;
  final DateTime? publishedAt;

  const FanchantVideo({
    required this.title,
    required this.channelName,
    this.publishedAt,
  });

  factory FanchantVideo.fromJson(Map<String, dynamic> json) => FanchantVideo(
    title: json['title'] as String? ?? '',
    channelName: json['channelName'] as String? ?? '',
    publishedAt: json['publishedAt'] != null
        ? DateTime.tryParse(json['publishedAt'] as String)
        : null,
  );
}

class Fanchant {
  final int trackId;
  final String trackTitle;
  final String albumTitle;
  final String videoId;
  final FanchantVideo? video;

  /// 앨범 커버에서 뽑은 두 색 (관리자가 지정했으면 그 값)
  final Color callColor;
  final Color singColor;
  final List<FanchantLine> lines;

  const Fanchant({
    required this.trackId,
    required this.trackTitle,
    required this.albumTitle,
    required this.videoId,
    this.video,
    required this.callColor,
    required this.singColor,
    required this.lines,
  });

  /// '#RRGGBB' → Color (형식이 깨졌으면 기본 그린)
  static Color _hex(String? v, Color fallback) {
    if (v == null || !RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(v)) return fallback;
    return Color(int.parse('FF${v.substring(1)}', radix: 16));
  }

  factory Fanchant.fromJson(Map<String, dynamic> json) {
    final colors = json['colors'] as Map<String, dynamic>? ?? {};
    return Fanchant(
      trackId: (json['trackId'] as num?)?.toInt() ?? 0,
      trackTitle: json['trackTitle'] as String? ?? '',
      albumTitle: json['albumTitle'] as String? ?? '',
      videoId: json['videoId'] as String? ?? '',
      video: json['video'] != null
          ? FanchantVideo.fromJson(json['video'] as Map<String, dynamic>)
          : null,
      callColor: _hex(colors['call'] as String?, const Color(0xFF548360)),
      singColor: _hex(colors['sing'] as String?, const Color(0xFF3E6348)),
      lines: (json['lines'] as List<dynamic>? ?? [])
          .map((l) => FanchantLine.fromJson(l as Map<String, dynamic>))
          .toList(),
    );
  }
}
