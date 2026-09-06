import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fromis9/controllers/schedule_controller.dart';
import 'package:fromis9/services/api_client.dart';

class PendingRequest {
  PendingRequest(this.options);
  final RequestOptions options;
  final result = Completer<ResponseBody>();
  void succeed(int id) {
    final year = options.queryParameters['year'];
    final month = options.queryParameters['month'].toString().padLeft(2, '0');
    result.complete(
      ResponseBody.fromString(
        jsonEncode({
          'schedules': [
            {'id': id, 'title': 'Schedule $id', 'date': '$year-$month-01'},
          ],
        }),
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      ),
    );
  }

  void fail(String message) {
    result.completeError(
      DioException(
        requestOptions: options,
        type: DioExceptionType.connectionError,
        message: message,
      ),
    );
  }
}

// Control real Dio responses while keeping every request off the network.
class ControlledAdapter implements HttpClientAdapter {
  final requests = <PendingRequest>[];
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    expect(options.path, '/schedules');
    final request = PendingRequest(options);
    requests.add(request);
    return request.result.future;
  }

  @override
  void close({bool force = false}) {}
}

Future<void> flush() async {
  for (var i = 0; i < 12; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

String monthKey(DateTime date) =>
    '${date.year}-${date.month.toString().padLeft(2, '0')}';

void main() {
  late HttpClientAdapter originalAdapter;
  late ControlledAdapter adapter;
  late ProviderContainer container;
  late ScheduleController controller;
  late DateTime firstMonth;
  late DateTime nextMonth;
  ScheduleState state() => container.read(scheduleProvider);
  setUp(() async {
    originalAdapter = dio.httpClientAdapter;
    adapter = ControlledAdapter();
    dio.httpClientAdapter = adapter;
    container = ProviderContainer();
    controller = container.read(scheduleProvider.notifier);
    final date = state().selectedDate;
    firstMonth = DateTime(date.year, date.month);
    nextMonth = DateTime(date.year, date.month + 1);
    await flush();
    expect(adapter.requests, hasLength(1));
  });
  tearDown(() async {
    container.dispose();
    for (final request in adapter.requests) {
      if (!request.result.isCompleted) request.succeed(0);
    }
    await flush();
    dio.httpClientAdapter = originalAdapter;
  });

  test('late previous-month success updates only its original cache', () async {
    controller.goToDate(nextMonth);
    await flush();
    adapter.requests[1].succeed(20);
    await flush();
    adapter.requests[0].succeed(10);
    await flush();
    expect(state().selectedDate, nextMonth);
    expect(state().schedules.single.id, 20);
    expect(state().selectedDateSchedules.single.id, 20);
    expect(state().calendarCache[monthKey(firstMonth)]!.single.id, 10);
    expect(state().calendarCache[monthKey(nextMonth)]!.single.id, 20);
    expect(state().getDaySchedules(nextMonth).single.id, 20);
    expect(state().isLoading, isFalse);
  });
  test(
    'late previous-month failure leaves current loading and error alone',
    () async {
      controller.changeMonth(1);
      await flush();
      adapter.requests[0].fail('old failure');
      await flush();
      expect(state().isLoading, isTrue);
      expect(state().error, isNull);
      adapter.requests[1].succeed(20);
      await flush();
      expect(state().schedules.single.id, 20);
      expect(state().error, isNull);
    },
  );
  test(
    'late previous-month success cannot clear the current request error',
    () async {
      controller.goToDate(nextMonth);
      await flush();
      adapter.requests[1].fail('current failure');
      await flush();
      final currentError = state().error;
      adapter.requests[0].succeed(10);
      await flush();
      expect(state().error, currentError);
      expect(state().error, contains('current failure'));
      expect(state().schedules, isEmpty);
      expect(state().isLoading, isFalse);
    },
  );
  test(
    'same-month refresh ignores an older response in both list and cache',
    () async {
      final refresh = controller.loadSchedules(silent: true);
      await flush();
      adapter.requests[1].succeed(20);
      await refresh;
      adapter.requests[0].succeed(10);
      await flush();
      expect(state().schedules.single.id, 20);
      expect(state().calendarCache[monthKey(firstMonth)]!.single.id, 20);
    },
  );
  test(
    'old calendar prefetch cannot overwrite a newer foreground request',
    () async {
      adapter.requests[0].succeed(1);
      await flush();
      final prefetch = controller.loadCalendarMonth(
        nextMonth.year,
        nextMonth.month,
      );
      await flush();
      controller.goToDate(nextMonth);
      await flush();
      adapter.requests[2].succeed(30);
      await flush();
      adapter.requests[1].succeed(20);
      await prefetch;
      expect(state().schedules.single.id, 30);
      expect(state().calendarCache[monthKey(nextMonth)]!.single.id, 30);
    },
  );
  test(
    'calendar prefetch preserves foreground errors and deduplicates requests',
    () async {
      adapter.requests[0].fail('visible failure');
      await flush();
      final prefetch = controller.loadCalendarMonth(
        nextMonth.year,
        nextMonth.month,
      );
      await controller.loadCalendarMonth(nextMonth.year, nextMonth.month);
      await flush();
      expect(adapter.requests, hasLength(2));
      adapter.requests[1].succeed(20);
      await prefetch;
      expect(state().error, contains('visible failure'));
      expect(state().isLoading, isFalse);
      expect(state().schedules, isEmpty);
      await controller.loadCalendarMonth(nextMonth.year, nextMonth.month);
      expect(adapter.requests, hasLength(2));
    },
  );
  test(
    'calendar prefetch does not duplicate an active foreground month',
    () async {
      await controller.loadCalendarMonth(firstMonth.year, firstMonth.month);
      expect(adapter.requests, hasLength(1));
      adapter.requests[0].succeed(10);
      await flush();
      expect(state().calendarCache[monthKey(firstMonth)]!.single.id, 10);
    },
  );
  test(
    'changing the selected day keeps the active month response valid',
    () async {
      controller.selectDate(firstMonth);
      adapter.requests[0].succeed(10);
      await flush();
      expect(state().selectedDate, firstMonth);
      expect(state().selectedDateSchedules.single.id, 10);
      expect(adapter.requests, hasLength(1));
    },
  );
  test('month round trip cannot revive the first stale request', () async {
    controller.goToDate(nextMonth);
    controller.goToDate(firstMonth);
    await flush();
    adapter.requests[2].succeed(30);
    await flush();
    adapter.requests[0].succeed(10);
    adapter.requests[1].succeed(20);
    await flush();
    expect(state().selectedDate, firstMonth);
    expect(state().schedules.single.id, 30);
    expect(state().calendarCache[monthKey(firstMonth)]!.single.id, 30);
    expect(state().calendarCache[monthKey(nextMonth)]!.single.id, 20);
  });
  test('moving to an uncached month clears the old list immediately', () async {
    adapter.requests[0].succeed(10);
    await flush();
    controller.goToDate(nextMonth);
    expect(state().schedules, isEmpty);
    expect(state().isLoading, isTrue);
  });
  test(
    'provider invalidation rejects responses from the old lifecycle',
    () async {
      container.invalidate(scheduleProvider);
      controller = container.read(scheduleProvider.notifier);
      await flush();
      adapter.requests[1].succeed(20);
      await flush();
      adapter.requests[0].succeed(10);
      await flush();
      expect(state().schedules.single.id, 20);
      expect(state().calendarCache[monthKey(firstMonth)]!.single.id, 20);
    },
  );
  test('responses after disposal cannot access provider state', () async {
    final prefetch = controller.loadCalendarMonth(
      nextMonth.year,
      nextMonth.month,
    );
    await flush();
    container.dispose();
    adapter.requests[0].succeed(10);
    adapter.requests[1].fail('disposed failure');
    await prefetch;
    await flush();
  });
}
