/// API 클라이언트 설정
library;

import 'package:dio/dio.dart';
import '../core/constants.dart';

/// Dio 인스턴스 (싱글톤)
final Dio dio = Dio(
  BaseOptions(
    baseUrl: apiBaseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
    headers: {'Content-Type': 'application/json'},
  ),
);
