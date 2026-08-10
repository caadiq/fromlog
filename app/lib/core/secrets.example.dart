/// `lib/core/secrets.dart`의 템플릿.
/// 이 파일을 secrets.dart로 복사한 뒤 실제 값을 채워 넣으면 빌드된다.
class Secrets {
  /// 카카오맵 네이티브 앱 키 (카카오 개발자 콘솔 > 앱 키)
  static const String kakaoNativeAppKey = 'YOUR_KAKAO_NATIVE_APP_KEY';

  /// 운영 알림 수신 기기 등록용 (백엔드 .env의 PUSH_ADMIN_KEY와 동일한 값)
  static const String pushAdminKey = 'YOUR_PUSH_ADMIN_KEY';

  /// Otto OTA 배포 서버 read 보호 키 (Otto 백엔드 .env의 APP_API_KEY)
  static const String ottoAppKey = 'YOUR_OTTO_APP_KEY';
}
