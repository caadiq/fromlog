/// 일정 모델
library;

/// 멤버 정보
class ScheduleMember {
  final int id;
  final String name;

  ScheduleMember({required this.id, required this.name});

  factory ScheduleMember.fromJson(Map<String, dynamic> json) {
    return ScheduleMember(id: json['id'] as int, name: json['name'] as String);
  }
}

/// 관련 일정 (콘서트 회차 등)
class RelatedDate {
  final int id;
  final String date;
  final String? time;

  RelatedDate({required this.id, required this.date, this.time});

  factory RelatedDate.fromJson(Map<String, dynamic> json) {
    return RelatedDate(
      id: json['id'] as int,
      date: json['date'] as String,
      time: json['time'] as String?,
    );
  }
}

/// 장소 (행사·팬사인회·콘서트)
class Venue {
  final String name;
  final String? address;
  final String? lat;
  final String? lng;

  Venue({required this.name, this.address, this.lat, this.lng});

  static Venue? fromJson(Map<String, dynamic>? json) {
    final name = json?['name'] as String?;
    if (name == null) return null;
    return Venue(
      name: name,
      address: json?['address'] as String?,
      lat: json?['lat']?.toString(),
      lng: json?['lng']?.toString(),
    );
  }

  bool get hasCoords => lat != null && lng != null;

  /// 카카오맵 링크 (웹과 동일)
  String? get kakaoMapUrl => hasCoords
      ? 'https://map.kakao.com/link/map/${Uri.encodeComponent(name)},$lat,$lng'
      : null;
}

/// 이미지 세트 (포스터·MD 등)
class ImageSet {
  final String? originalUrl;
  final String? mediumUrl;
  final String? thumbUrl;

  ImageSet({this.originalUrl, this.mediumUrl, this.thumbUrl});

  factory ImageSet.fromJson(Map<String, dynamic> json) => ImageSet(
    originalUrl: json['originalUrl'] as String?,
    mediumUrl: json['mediumUrl'] as String?,
    thumbUrl: json['thumbUrl'] as String?,
  );

  String? get best => mediumUrl ?? originalUrl ?? thumbUrl;
  String? get thumb => thumbUrl ?? mediumUrl ?? originalUrl;
  String? get full => originalUrl ?? mediumUrl ?? thumbUrl;
}

/// 콘서트 세트리스트 곡
class SetlistItem {
  final int order;
  final String songName;
  final String? albumName;
  final List<ScheduleMember> members;

  SetlistItem({
    required this.order,
    required this.songName,
    this.albumName,
    this.members = const [],
  });

  factory SetlistItem.fromJson(Map<String, dynamic> json) => SetlistItem(
    order: (json['order'] as num?)?.toInt() ?? 0,
    songName: json['songName'] as String? ?? '',
    albumName: json['albumName'] as String?,
    members:
        (json['members'] as List<dynamic>?)
            ?.map((m) => ScheduleMember.fromJson(m))
            .toList() ??
        [],
  );
}

/// 콘서트 회차
class ConcertRound {
  final int scheduleId;
  final String date;
  final String? time;

  ConcertRound({required this.scheduleId, required this.date, this.time});

  factory ConcertRound.fromJson(Map<String, dynamic> json) => ConcertRound(
    scheduleId: (json['scheduleId'] as num).toInt(),
    date: json['date'] as String,
    time: json['time'] as String?,
  );
}

/// X 링크 미리보기(OG) 카드
class XCard {
  final String url;
  final String? title;
  final String? description;
  final String? destination;
  final String? image;

  XCard({
    required this.url,
    this.title,
    this.description,
    this.destination,
    this.image,
  });

  static XCard? fromJson(Map<String, dynamic>? json) {
    final url = json?['url'] as String?;
    if (url == null) return null;
    return XCard(
      url: url,
      title: json?['title'] as String?,
      description: json?['description'] as String?,
      destination: json?['destination'] as String?,
      image: json?['image'] as String?,
    );
  }
}

/// 일정 상세 모델
/// 티켓팅 세트 상대 일정 (선예매 ↔ 일반예매)
class TicketingPair {
  final int scheduleId;
  final String stage; // 'presale' | 'general'
  final String date;
  final String? time;

  TicketingPair({
    required this.scheduleId,
    required this.stage,
    required this.date,
    this.time,
  });

  factory TicketingPair.fromJson(Map<String, dynamic> json) => TicketingPair(
        scheduleId: json['scheduleId'] as int,
        stage: json['stage'] as String,
        date: json['date'] as String,
        time: json['time'] as String?,
      );
}

/// 티켓팅에 연결된 콘서트 카드 정보
class TicketingConcert {
  final int seriesId;
  final String title;
  final String? posterThumbUrl;
  final String? startDate;
  final String? endDate;
  final String? venueName;
  final int? firstScheduleId;

  TicketingConcert({
    required this.seriesId,
    required this.title,
    this.posterThumbUrl,
    this.startDate,
    this.endDate,
    this.venueName,
    this.firstScheduleId,
  });

  factory TicketingConcert.fromJson(Map<String, dynamic> json) =>
      TicketingConcert(
        seriesId: json['seriesId'] as int,
        title: json['title'] as String,
        posterThumbUrl: json['posterThumbUrl'] as String?,
        startDate: json['startDate'] as String?,
        endDate: json['endDate'] as String?,
        venueName: json['venueName'] as String?,
        firstScheduleId: json['firstScheduleId'] as int?,
      );
}

class ScheduleDetail {
  final int id;
  final String title;
  final String date;
  final String? time;
  final int? categoryId;
  final String? categoryName;
  final String? categoryColor;
  final List<ScheduleMember> members;
  // YouTube 관련
  final String? channelName;
  final String? videoId;
  final String? videoType;
  final String? videoUrl;
  final String? bannerUrl;
  // X 관련
  final String? postId;
  final String? username;
  final String? content;
  final List<String> imageUrls;
  final List<String> videoThumbnails;
  final XCard? card;
  final String? postUrl;
  // X 프로필
  final String? profileDisplayName;
  final String? profileAvatarUrl;
  // 기타 일정 설명
  final String? description;

  /// 앨범 발매 일정 — 로드 후 앨범 상세로 리다이렉트
  final String? albumFolder;
  // 행사·팬사인회·콘서트 공통
  final Venue? venue;
  final List<String> postUrls;
  // 행사
  final String? subtype;
  final String? schoolName;
  final List<ImageSet> posters;
  // 팬사인회
  final String? format; // 'offline' | 'online' | 'both'
  final String? fansignHost; // 팬사인회 주최 (음반점)
  // 콘서트
  final ImageSet? poster;
  final List<SetlistItem> setlist;
  final List<ImageSet> merchandise;
  final List<ConcertRound> otherRounds;
  final int? activeMemberCount;
  // 예능 관련
  final String? broadcaster;
  final String? replayUrl;
  final String? varietyThumbnailUrl;
  // 티켓팅
  final String? stage; // 'presale' | 'general'
  final String? vendor;
  final String? ticketUrl;
  final String? purchaseLimit;
  final String? authStart; // 'YYYY-MM-DD HH:mm'
  final String? authEnd;
  final String? authNote;
  final TicketingPair? ticketingPair;
  final TicketingConcert? ticketingConcert;

  ScheduleDetail({
    required this.id,
    required this.title,
    required this.date,
    this.time,
    this.categoryId,
    this.categoryName,
    this.categoryColor,
    this.members = const [],
    this.channelName,
    this.videoId,
    this.videoType,
    this.videoUrl,
    this.bannerUrl,
    this.postId,
    this.username,
    this.content,
    this.imageUrls = const [],
    this.videoThumbnails = const [],
    this.card,
    this.postUrl,
    this.profileDisplayName,
    this.profileAvatarUrl,
    this.description,
    this.venue,
    this.postUrls = const [],
    this.subtype,
    this.schoolName,
    this.posters = const [],
    this.format,
    this.fansignHost,
    this.poster,
    this.setlist = const [],
    this.merchandise = const [],
    this.otherRounds = const [],
    this.activeMemberCount,
    this.broadcaster,
    this.replayUrl,
    this.varietyThumbnailUrl,
    this.albumFolder,
    this.stage,
    this.vendor,
    this.ticketUrl,
    this.purchaseLimit,
    this.authStart,
    this.authEnd,
    this.authNote,
    this.ticketingPair,
    this.ticketingConcert,
  });

  factory ScheduleDetail.fromJson(Map<String, dynamic> json) {
    // category 중첩 객체 파싱
    final category = json['category'] as Map<String, dynamic>?;

    return ScheduleDetail(
      id: json['id'] as int,
      title: json['title'] as String,
      date: json['date'] as String,
      time: json['time'] as String?,
      categoryId: category?['id'] as int?,
      categoryName: category?['name'] as String?,
      categoryColor: category?['color'] as String?,
      members:
          (json['members'] as List<dynamic>?)
              ?.map((m) => ScheduleMember.fromJson(m))
              .toList() ??
          [],
      channelName: json['channelName'] as String?,
      videoId: json['videoId'] as String?,
      videoType: json['videoType'] as String?,
      videoUrl: json['videoUrl'] as String?,
      bannerUrl: json['bannerUrl'] as String?,
      postId: json['postId'] as String?,
      username: json['username'] as String?,
      content: json['content'] as String?,
      imageUrls: (json['imageUrls'] as List<dynamic>?)?.cast<String>() ?? [],
      videoThumbnails:
          (json['videoThumbnails'] as List<dynamic>?)?.cast<String>() ?? [],
      card: XCard.fromJson(json['card'] as Map<String, dynamic>?),
      postUrl: json['postUrl'] as String?,
      profileDisplayName:
          (json['profile'] as Map<String, dynamic>?)?['displayName'] as String?,
      profileAvatarUrl:
          (json['profile'] as Map<String, dynamic>?)?['avatarUrl'] as String?,
      description: json['description'] as String?,
      albumFolder: json['albumFolder'] as String?,
      venue: Venue.fromJson(json['venue'] as Map<String, dynamic>?),
      postUrls: (json['postUrls'] as List<dynamic>?)?.cast<String>() ?? [],
      subtype: json['subtype'] as String?,
      schoolName: json['schoolName'] as String?,
      posters:
          (json['posters'] as List<dynamic>?)
              ?.map((p) => ImageSet.fromJson(p))
              .toList() ??
          [],
      format: json['format'] as String?,
      fansignHost: json['host'] as String?,
      poster: json['poster'] != null
          ? ImageSet.fromJson(json['poster'] as Map<String, dynamic>)
          : null,
      setlist:
          (json['setlist'] as List<dynamic>?)
              ?.map((t) => SetlistItem.fromJson(t))
              .toList() ??
          [],
      merchandise:
          (json['merchandise'] as List<dynamic>?)
              ?.map((m) => ImageSet.fromJson(m))
              .toList() ??
          [],
      otherRounds:
          (json['otherRounds'] as List<dynamic>?)
              ?.map((r) => ConcertRound.fromJson(r))
              .toList() ??
          [],
      activeMemberCount: (json['activeMemberCount'] as num?)?.toInt(),
      broadcaster: json['broadcaster'] as String?,
      replayUrl: json['replayUrl'] as String?,
      varietyThumbnailUrl: json['thumbnailUrl'] as String?,
      stage: json['stage'] as String?,
      vendor: json['vendor'] as String?,
      ticketUrl: json['ticketUrl'] as String?,
      purchaseLimit: json['purchaseLimit'] as String?,
      authStart: json['authStart'] as String?,
      authEnd: json['authEnd'] as String?,
      authNote: json['authNote'] as String?,
      ticketingPair: json['pair'] != null
          ? TicketingPair.fromJson(json['pair'] as Map<String, dynamic>)
          : null,
      ticketingConcert: json['concert'] != null
          ? TicketingConcert.fromJson(json['concert'] as Map<String, dynamic>)
          : null,
    );
  }

}

class Schedule {
  /// ID (일반 일정: int, 생일/기념일: String)
  final dynamic id;
  final String title;
  final String date;

  /// 날짜 정밀도: 'day'(확정) | 'month'(월만 확정 = 날짜 미정)
  final String datePrecision;
  final String? time;
  final int? categoryId;
  final String? categoryName;
  final String? categoryColor;
  final List<String> members;
  final String? sourceName;
  final String? sourceUrl;
  // 특별 일정 필드
  final bool isBirthday;
  final bool isDebut;
  final bool isAnniversary;
  final String? memberImage;
  final int? anniversaryYear;

  /// 앨범 발매 일정 — 탭 시 앨범 상세로 이동
  final String? albumFolder;

  Schedule({
    required this.id,
    required this.title,
    required this.date,
    this.datePrecision = 'day',
    this.time,
    this.categoryId,
    this.categoryName,
    this.categoryColor,
    this.members = const [],
    this.sourceName,
    this.sourceUrl,
    this.isBirthday = false,
    this.isDebut = false,
    this.isAnniversary = false,
    this.memberImage,
    this.anniversaryYear,
    this.albumFolder,
  });

  factory Schedule.fromJson(Map<String, dynamic> json) {
    // category 중첩 객체 파싱
    final category = json['category'] as Map<String, dynamic>?;

    // members 배열 파싱
    final membersList =
        (json['members'] as List<dynamic>?)
            ?.map((m) => m is String ? m : m.toString())
            .toList() ??
        [];

    // source 중첩 객체 파싱
    final source = json['source'] as Map<String, dynamic>?;

    return Schedule(
      id: json['id'], // int 또는 String (생일/기념일)
      title: json['title'] as String,
      date: json['date'] as String,
      datePrecision: (json['datePrecision'] as String?) ?? 'day',
      time: json['time'] as String?,
      categoryId: category?['id'] as int?,
      categoryName: category?['name'] as String?,
      categoryColor: category?['color'] as String?,
      members: membersList,
      sourceName: source?['name'] as String?,
      sourceUrl: source?['url'] as String?,
      isBirthday: json['is_birthday'] == true,
      isDebut: json['is_debut'] == true,
      isAnniversary: json['is_anniversary'] == true,
      memberImage: json['member_image'] as String?,
      anniversaryYear: (json['anniversary_year'] as num?)?.toInt(),
      albumFolder: json['albumFolder'] as String?,
    );
  }

  /// 특별 일정 여부 (생일, 데뷔, 기념일)
  bool get isSpecial => isBirthday || isDebut || isAnniversary;

  /// 날짜 미정(월만 확정) 여부
  bool get isUndated => datePrecision == 'month';
}
