/// 일정 API 서비스
library;

import 'package:intl/intl.dart';
import '../models/schedule.dart';
import '../models/schedule_link.dart';
import 'api_client.dart';

/// 오늘 날짜 (KST) 반환
String getTodayKST() {
  final now = DateTime.now();
  return DateFormat('yyyy-MM-dd').format(now);
}

/// 일정 목록 조회 (월별)
Future<List<Schedule>> getSchedules(int year, int month) async {
  final response = await dio.get(
    '/schedules',
    queryParameters: {'year': year.toString(), 'month': month.toString()},
  );
  final Map<String, dynamic> data = response.data;
  final List<dynamic> schedulesJson = data['schedules'] ?? [];
  return schedulesJson.map((json) => Schedule.fromJson(json)).toList();
}

/// 다가오는 일정 N개 조회 (오늘 이후) - 웹과 동일
Future<List<Schedule>> getUpcomingSchedules(int limit) async {
  final todayStr = getTodayKST();
  final response = await dio.get(
    '/schedules',
    queryParameters: {'startDate': todayStr, 'limit': limit.toString()},
  );
  final Map<String, dynamic> data = response.data;
  final List<dynamic> schedulesJson = data['schedules'] ?? [];
  return schedulesJson.map((json) => Schedule.fromJson(json)).toList();
}

/// 일정 검색 결과
class SearchResult {
  final List<Schedule> schedules;
  final int offset;
  final bool hasMore;

  const SearchResult({
    required this.schedules,
    required this.offset,
    required this.hasMore,
  });
}

/// 일정 검색 (Meilisearch)
Future<SearchResult> searchSchedules(
  String query, {
  int offset = 0,
  int limit = 20,
}) async {
  final response = await dio.get(
    '/schedules',
    queryParameters: {
      'search': query,
      'offset': offset.toString(),
      'limit': limit.toString(),
    },
  );
  // 응답: { schedules: [...], hasMore: bool, offset: int }
  final Map<String, dynamic> data = response.data;
  final List<dynamic> schedulesJson = data['schedules'] ?? [];
  final schedules = schedulesJson
      .map((json) => Schedule.fromJson(json))
      .toList();
  return SearchResult(
    schedules: schedules,
    offset: offset,
    hasMore: data['hasMore'] ?? schedules.length >= limit,
  );
}

/// 단일 일정 상세 조회
Future<ScheduleDetail> getSchedule(int id) async {
  final response = await dio.get('/schedules/$id');
  return ScheduleDetail.fromJson(response.data);
}

/// 추천 검색어 조회
Future<List<String>> getSuggestions(String query, {int limit = 10}) async {
  if (query.trim().isEmpty) return [];

  try {
    final response = await dio.get(
      '/schedules/suggestions',
      queryParameters: {'q': query, 'limit': limit.toString()},
    );
    final Map<String, dynamic> data = response.data;
    final List<dynamic> suggestions = data['suggestions'] ?? [];
    return suggestions.cast<String>();
  } catch (e) {
    return [];
  }
}

/// 일정 페이지 고정 링크 (노출 기간에 걸린 것만 서버가 내려준다)
Future<List<ScheduleLink>> getScheduleLinks() async {
  final response = await dio.get('/schedule-links');
  final List<dynamic> list = response.data ?? [];
  return list.map((json) => ScheduleLink.fromJson(json)).toList();
}
