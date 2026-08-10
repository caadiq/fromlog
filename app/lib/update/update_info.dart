/// Otto latest 매니페스트 모델.
class UpdateInfo {
  final int versionCode;
  final String versionName;
  final String downloadUrl;
  final String? changelog;
  final bool mandatory;
  final int size;
  final String sha256;

  UpdateInfo({
    required this.versionCode,
    required this.versionName,
    required this.downloadUrl,
    required this.changelog,
    required this.mandatory,
    required this.size,
    required this.sha256,
  });

  factory UpdateInfo.fromJson(Map<String, dynamic> json) {
    return UpdateInfo(
      versionCode: json['versionCode'] as int,
      versionName: json['versionName'] as String,
      downloadUrl: json['downloadUrl'] as String,
      changelog: json['changelog'] as String?,
      mandatory: json['mandatory'] as bool? ?? false,
      size: (json['size'] as num?)?.toInt() ?? 0,
      sha256: json['sha256'] as String? ?? '',
    );
  }
}
