/// 멤버 모델
library;

class Member {
  final int id;
  final String name;
  final String? nameEn;
  final String? imageUrl;
  final String? imageMedium;
  final String? imageThumb;
  final String? birthDate;
  final String? position;
  final String? instagram;
  final bool isFormer;

  Member({
    required this.id,
    required this.name,
    this.nameEn,
    this.imageUrl,
    this.imageMedium,
    this.imageThumb,
    this.birthDate,
    this.position,
    this.instagram,
    this.isFormer = false,
  });

  factory Member.fromJson(Map<String, dynamic> json) {
    return Member(
      id: json['id'] as int,
      name: json['name'] as String,
      nameEn: json['name_en'] as String?,
      imageUrl: json['image_url'] as String?,
      imageMedium: json['image_medium'] as String?,
      imageThumb: json['image_thumb'] as String?,
      birthDate: json['birth_date'] as String?,
      position: json['position'] as String?,
      instagram: json['instagram'] as String?,
      isFormer: json['is_former'] == 1 || json['is_former'] == true,
    );
  }
}

/// 멤버 컨셉 포토 (개인·유닛 태깅 + 단체)
class MemberPhoto {
  final int id;
  final String? mediumUrl;
  final String? thumbUrl;
  final String? conceptName;
  final String photoType; // 'group' | 'unit' | 'solo'
  final int? width;
  final int? height;
  final String? albumTitle;

  MemberPhoto({
    required this.id,
    this.mediumUrl,
    this.thumbUrl,
    this.conceptName,
    this.photoType = 'group',
    this.width,
    this.height,
    this.albumTitle,
  });

  factory MemberPhoto.fromJson(Map<String, dynamic> json) {
    return MemberPhoto(
      id: json['id'] as int,
      mediumUrl: json['medium_url'] as String?,
      thumbUrl: json['thumb_url'] as String?,
      conceptName: json['concept_name'] as String?,
      photoType: (json['photo_type'] as String?) ?? 'group',
      width: json['width'] as int?,
      height: json['height'] as int?,
      albumTitle: json['album_title'] as String?,
    );
  }
}
