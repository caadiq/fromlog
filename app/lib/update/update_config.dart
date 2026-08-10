// Otto 인앱 OTA 설정값. 앱마다 이 파일만 바꾸면 드롭인 적용.
// appKey 실제 값은 git에 올리지 않는 core/secrets.dart에 둔다.
import '../core/secrets.dart';

class UpdateConfig {
  static const String appId = 'fromlog';
  static const String baseUrl = 'https://otto.caadiq.co.kr';
  static const String appKey = Secrets.ottoAppKey;
}
