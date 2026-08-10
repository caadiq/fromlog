/// 영상 아카이브 모델 (웹 /api/videos 응답 대응)
library;

/// 영상 항목
class VideoItem {
  final String videoId;
  final String title;
  final String? channelName;
  final String category;
  final String videoType; // 'video' | 'shorts'
  final int? duration; // 영상 길이(초). 쇼츠·라이브는 null
  final String publishedAt; // 'YYYY-MM-DD HH:mm'

  const VideoItem({
    required this.videoId,
    required this.title,
    this.channelName,
    required this.category,
    required this.videoType,
    this.duration,
    required this.publishedAt,
  });

  bool get isShorts => videoType == 'shorts';

  /// 영상 링크 (쇼츠는 쇼츠 URL — 웹 videoUrl과 동일)
  String get url => isShorts
      ? 'https://www.youtube.com/shorts/$videoId'
      : 'https://www.youtube.com/watch?v=$videoId';

  factory VideoItem.fromJson(Map<String, dynamic> json) {
    return VideoItem(
      videoId: json['videoId'] ?? '',
      title: json['title'] ?? '',
      channelName: json['channelName'],
      category: json['category'] ?? 'variety',
      videoType: json['videoType'] ?? 'video',
      duration: (json['duration'] as num?)?.toInt(),
      publishedAt: json['publishedAt'] ?? '',
    );
  }
}

/// 영상 메인 화면 데이터 (/videos/home)
class VideoHomeData {
  final VideoItem? featured;
  final Map<String, List<VideoItem>> sections;
  final List<VideoItem> shorts;
  final Map<String, int> counts;
  final Map<String, String?> labels;

  const VideoHomeData({
    this.featured,
    this.sections = const {},
    this.shorts = const [],
    this.counts = const {},
    this.labels = const {},
  });

  factory VideoHomeData.fromJson(Map<String, dynamic> json) {
    final sections = <String, List<VideoItem>>{};
    (json['sections'] as Map<String, dynamic>? ?? {}).forEach((k, v) {
      sections[k] =
          (v as List).map((e) => VideoItem.fromJson(e)).toList(growable: false);
    });
    return VideoHomeData(
      featured: json['featured'] != null ? VideoItem.fromJson(json['featured']) : null,
      sections: sections,
      shorts: (json['shorts'] as List? ?? [])
          .map((e) => VideoItem.fromJson(e))
          .toList(growable: false),
      counts: (json['counts'] as Map<String, dynamic>? ?? {})
          .map((k, v) => MapEntry(k, (v as num).toInt())),
      labels: (json['labels'] as Map<String, dynamic>? ?? {})
          .map((k, v) => MapEntry(k, v as String?)),
    );
  }
}

/// 채널 파셋 (전체보기 필터)
class ChannelFacet {
  final String name;
  final int count;

  const ChannelFacet({required this.name, required this.count});

  factory ChannelFacet.fromJson(Map<String, dynamic> json) {
    return ChannelFacet(
      name: json['name'] ?? '',
      count: (json['count'] as num?)?.toInt() ?? 0,
    );
  }
}

/// 전체보기 페이지 응답 (/videos)
class VideoListPage {
  final List<VideoItem> videos;
  final int total;
  final int offset;
  final int limit;
  final bool hasMore;
  final Map<String, int> monthCounts; // 'YYYY-MM' → 개수
  final List<ChannelFacet> channels;
  final String? categoryLabel;

  const VideoListPage({
    this.videos = const [],
    this.total = 0,
    this.offset = 0,
    this.limit = 0,
    this.hasMore = false,
    this.monthCounts = const {},
    this.channels = const [],
    this.categoryLabel,
  });

  factory VideoListPage.fromJson(Map<String, dynamic> json) {
    return VideoListPage(
      videos: (json['videos'] as List? ?? [])
          .map((e) => VideoItem.fromJson(e))
          .toList(growable: false),
      total: (json['total'] as num?)?.toInt() ?? 0,
      offset: (json['offset'] as num?)?.toInt() ?? 0,
      limit: (json['limit'] as num?)?.toInt() ?? 0,
      hasMore: json['hasMore'] == true,
      monthCounts: {
        for (final m in (json['months'] as List? ?? []))
          (m['ym'] as String): (m['count'] as num).toInt(),
      },
      channels: ((json['facets']?['channels']) as List? ?? [])
          .map((e) => ChannelFacet.fromJson(e))
          .toList(growable: false),
      categoryLabel: json['categoryLabel'],
    );
  }
}
