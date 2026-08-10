/// 앨범 모델
library;

class Album {
  final int id;
  final String title;
  final String? albumType;
  final String? albumTypeShort;
  final String? releaseDate;
  final String? coverOriginalUrl;
  final String? coverMediumUrl;
  final String? coverThumbUrl;
  final String? folderName;
  final String? description;
  final List<Track>? tracks;
  final List<Teaser>? teasers;
  final Map<String, List<ConceptPhoto>>? conceptPhotos;

  Album({
    required this.id,
    required this.title,
    this.albumType,
    this.albumTypeShort,
    this.releaseDate,
    this.coverOriginalUrl,
    this.coverMediumUrl,
    this.coverThumbUrl,
    this.folderName,
    this.description,
    this.tracks,
    this.teasers,
    this.conceptPhotos,
  });

  factory Album.fromJson(Map<String, dynamic> json) {
    // 트랙 파싱
    List<Track>? tracks;
    if (json['tracks'] != null) {
      tracks = (json['tracks'] as List).map((t) => Track.fromJson(t)).toList();
    }

    // 티저 파싱
    List<Teaser>? teasers;
    if (json['teasers'] != null) {
      teasers = (json['teasers'] as List)
          .map((t) => Teaser.fromJson(t))
          .toList();
    }

    // 컨셉 포토 파싱
    Map<String, List<ConceptPhoto>>? conceptPhotos;
    if (json['conceptPhotos'] != null) {
      conceptPhotos = {};
      (json['conceptPhotos'] as Map<String, dynamic>).forEach((key, value) {
        conceptPhotos![key] = (value as List)
            .map((p) => ConceptPhoto.fromJson(p, concept: key))
            .toList();
      });
    }

    return Album(
      id: (json['id'] as num?)?.toInt() ?? 0,
      title: json['title'] as String? ?? '',
      albumType: json['album_type'] as String?,
      albumTypeShort: json['album_type_short'] as String?,
      releaseDate: json['release_date'] as String?,
      coverOriginalUrl: json['cover_original_url'] as String?,
      coverMediumUrl: json['cover_medium_url'] as String?,
      coverThumbUrl: json['cover_thumb_url'] as String?,
      folderName: json['folder_name'] as String?,
      description: json['description'] as String?,
      tracks: tracks,
      teasers: teasers,
      conceptPhotos: conceptPhotos,
    );
  }

  /// 발매 년도 추출
  String? get releaseYear => releaseDate?.substring(0, 4);

  /// 총 재생 시간 계산
  String get totalDuration {
    if (tracks == null || tracks!.isEmpty) return '';
    int totalSeconds = 0;
    for (final track in tracks!) {
      if (track.duration != null) {
        final parts = track.duration!.split(':');
        if (parts.length == 2) {
          totalSeconds += int.parse(parts[0]) * 60 + int.parse(parts[1]);
        }
      }
    }
    final mins = totalSeconds ~/ 60;
    final secs = totalSeconds % 60;
    return '$mins:${secs.toString().padLeft(2, '0')}';
  }

  /// 모든 컨셉 포토 리스트
  List<ConceptPhoto> get allConceptPhotos {
    if (conceptPhotos == null) return [];
    return conceptPhotos!.values.expand((list) => list).toList();
  }
}

/// 트랙 모델
class Track {
  final int id;
  final int trackNumber;
  final String title;
  final String? duration;
  final int isTitleTrack;
  final String? videoUrl;

  Track({
    required this.id,
    required this.trackNumber,
    required this.title,
    this.duration,
    this.isTitleTrack = 0,
    this.videoUrl,
  });

  factory Track.fromJson(Map<String, dynamic> json) {
    return Track(
      id: (json['id'] as num?)?.toInt() ?? 0,
      trackNumber: (json['track_number'] as num?)?.toInt() ?? 0,
      title: json['title'] as String? ?? '',
      duration: json['duration'] as String?,
      isTitleTrack: (json['is_title_track'] as num?)?.toInt() ?? 0,
      videoUrl: json['video_url'] as String?,
    );
  }
}

/// 티저 모델
class Teaser {
  final int id;
  final String? originalUrl;
  final String? thumbUrl;
  final String? videoUrl;
  final String? mediaType;

  Teaser({
    required this.id,
    this.originalUrl,
    this.thumbUrl,
    this.videoUrl,
    this.mediaType,
  });

  factory Teaser.fromJson(Map<String, dynamic> json) {
    return Teaser(
      id: (json['id'] as num?)?.toInt() ?? 0,
      originalUrl: json['original_url'] as String?,
      thumbUrl: json['thumb_url'] as String?,
      videoUrl: json['video_url'] as String?,
      mediaType: json['media_type'] as String?,
    );
  }
}

/// 컨셉 포토 모델
class ConceptPhoto {
  final int id;
  final String? originalUrl;
  final String? mediumUrl;
  final String? thumbUrl;
  final int? width;
  final int? height;
  final String? members;
  final String? concept;
  final String? type; // 'group' | 'unit' | 'solo'

  ConceptPhoto({
    required this.id,
    this.originalUrl,
    this.mediumUrl,
    this.thumbUrl,
    this.width,
    this.height,
    this.members,
    this.concept,
    this.type,
  });

  factory ConceptPhoto.fromJson(Map<String, dynamic> json, {String? concept}) {
    return ConceptPhoto(
      id: (json['id'] as num?)?.toInt() ?? 0,
      originalUrl: json['original_url'] as String?,
      mediumUrl: json['medium_url'] as String?,
      thumbUrl: json['thumb_url'] as String?,
      width: (json['width'] as num?)?.toInt(),
      height: (json['height'] as num?)?.toInt(),
      members: json['members'] as String?,
      concept: concept ?? json['concept'] as String?,
      type: json['type'] as String?,
    );
  }

  /// 이미지 종횡비
  double get aspectRatio {
    if (width != null && height != null && width! > 0) {
      return height! / width!;
    }
    return 1.0;
  }
}

/// 트랙 상세 모델 (앨범 정보 포함)
class TrackDetail {
  final int id;
  final int trackNumber;
  final String title;
  final String? duration;
  final int isTitleTrack;
  final String? lyricist;
  final String? composer;
  final String? arranger;
  final String? lyrics;
  final String? musicVideoUrl;
  final String? videoType;
  final TrackAlbum? album;
  final List<Track> otherTracks;

  TrackDetail({
    required this.id,
    required this.trackNumber,
    required this.title,
    this.duration,
    this.isTitleTrack = 0,
    this.lyricist,
    this.composer,
    this.arranger,
    this.lyrics,
    this.musicVideoUrl,
    this.videoType,
    this.album,
    this.otherTracks = const [],
  });

  factory TrackDetail.fromJson(Map<String, dynamic> json) {
    return TrackDetail(
      id: (json['id'] as num?)?.toInt() ?? 0,
      trackNumber: (json['track_number'] as num?)?.toInt() ?? 0,
      title: json['title'] as String? ?? '',
      duration: json['duration'] as String?,
      isTitleTrack: (json['is_title_track'] as num?)?.toInt() ?? 0,
      lyricist: json['lyricist'] as String?,
      composer: json['composer'] as String?,
      arranger: json['arranger'] as String?,
      lyrics: json['lyrics'] as String?,
      musicVideoUrl: json['video_url'] as String?,
      videoType: json['video_type'] as String?,
      album: json['album'] != null ? TrackAlbum.fromJson(json['album']) : null,
      otherTracks: (json['otherTracks'] as List?)
              ?.map((t) => Track.fromJson(t))
              .toList() ??
          const [],
    );
  }
}

/// 트랙에 포함된 앨범 정보
class TrackAlbum {
  final int id;
  final String title;
  final String? albumType;
  final String? coverMediumUrl;
  final String? folderName;

  TrackAlbum({
    required this.id,
    required this.title,
    this.albumType,
    this.coverMediumUrl,
    this.folderName,
  });

  factory TrackAlbum.fromJson(Map<String, dynamic> json) {
    return TrackAlbum(
      id: (json['id'] as num?)?.toInt() ?? 0,
      title: json['title'] as String? ?? '',
      albumType: json['album_type'] as String?,
      coverMediumUrl: json['cover_medium_url'] as String?,
      folderName: json['folder_name'] as String?,
    );
  }
}
