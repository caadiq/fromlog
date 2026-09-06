import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fromis9/controllers/schedule_controller.dart';
import 'package:fromis9/services/api_client.dart';

class SearchRequest {
  SearchRequest(this.options);
  final RequestOptions options;
  final response = Completer<ResponseBody>();
  void succeed(List<int> ids, {bool more = false}) {
    final query =
        options.queryParameters['search'] ?? options.queryParameters['q'];
    response.complete(
      ResponseBody.fromString(
        jsonEncode({
          'schedules': ids
              .map(
                (id) => {'id': id, 'title': '$query $id', 'date': '2026-09-06'},
              )
              .toList(),
          'hasMore': more,
          'suggestions': ids.map((id) => '$query $id').toList(),
        }),
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      ),
    );
  }

  void fail() => response.completeError(
    DioException(
      requestOptions: options,
      type: DioExceptionType.connectionError,
      message: 'controlled failure',
    ),
  );
}

// Run the real Riverpod controllers and Dio parser without contacting the API.
class SearchAdapter implements HttpClientAdapter {
  final requests = <SearchRequest>[];
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    final request = SearchRequest(options);
    requests.add(request);
    return request.response.future;
  }

  @override
  void close({bool force = false}) {}
}

Future<void> flushSearch() async {
  for (var i = 0; i < 12; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  late ProviderContainer container;
  late SearchAdapter adapter;
  late HttpClientAdapter originalAdapter;
  late ScheduleSearchController search;
  late SuggestionController suggestions;
  SearchState state() => container.read(searchProvider);
  SuggestionState suggestionState() => container.read(suggestionProvider);
  setUp(() {
    adapter = SearchAdapter();
    originalAdapter = dio.httpClientAdapter;
    dio.httpClientAdapter = adapter;
    container = ProviderContainer();
    search = container.read(searchProvider.notifier);
    suggestions = container.read(suggestionProvider.notifier);
  });
  tearDown(() async {
    container.dispose();
    for (final request in adapter.requests) {
      if (!request.response.isCompleted) request.succeed([]);
    }
    await flushSearch();
    dio.httpClientAdapter = originalAdapter;
  });
  Future<void> firstPage() async {
    final pending = search.search('하영');
    await flushSearch();
    adapter.requests.last.succeed([1, 2], more: true);
    await pending;
  }

  for (final fail in [false, true]) {
    test(
      'old search ${fail ? 'failure' : 'success'} cannot overwrite a newer result',
      () async {
        final old = search.search('하영');
        final current = search.search('지원');
        await flushSearch();
        adapter.requests[1].succeed([20]);
        await current;
        if (fail) {
          adapter.requests[0].fail();
        } else {
          adapter.requests[0].succeed([10], more: true);
        }
        await old;
        expect(state().searchTerm, '지원');
        expect(state().results.map((s) => s.id), [20]);
        expect(state().offset, 1);
        expect(state().hasMore, isFalse);
        expect(state().isLoading, isFalse);
        expect(state().error, isNull);
      },
    );
  }
  test('old failure does not stop the current loading indicator', () async {
    final old = search.search('하영');
    final current = search.search('지원');
    await flushSearch();
    adapter.requests[0].fail();
    await old;
    expect(state().isLoading, isTrue);
    expect(state().error, isNull);
    adapter.requests[1].succeed([]);
    await current;
    expect(state().results, isEmpty);
    expect(state().hasMore, isFalse);
  });
  test(
    'repeating the same search text still invalidates the earlier request',
    () async {
      final old = search.search('지원');
      final current = search.search('지원');
      await flushSearch();
      adapter.requests[1].succeed([2]);
      await current;
      adapter.requests[0].succeed([1]);
      await old;
      expect(state().results.single.id, 2);
    },
  );
  for (final blank in [false, true]) {
    test(
      '${blank ? 'blank search' : 'clear'} invalidates an active first page',
      () async {
        final pending = search.search('하영');
        await flushSearch();
        if (blank) {
          await search.search('  ');
        } else {
          search.clear();
        }
        adapter.requests[0].succeed([1]);
        await pending;
        expect(state().searchTerm, isEmpty);
        expect(state().results, isEmpty);
        expect(state().offset, 0);
        expect(state().isLoading, isFalse);
      },
    );
  }
  for (final fail in [false, true]) {
    test(
      'old extra-page ${fail ? 'failure' : 'success'} cannot affect a new search',
      () async {
        await firstPage();
        final page = search.loadMore();
        await flushSearch();
        expect(adapter.requests[1].options.queryParameters['offset'], '2');
        final current = search.search('지원');
        await flushSearch();
        adapter.requests[2].succeed([20]);
        await current;
        if (fail) {
          adapter.requests[1].fail();
        } else {
          adapter.requests[1].succeed([3, 4], more: true);
        }
        await page;
        expect(state().results.map((s) => s.id), [20]);
        expect(state().offset, 1);
        expect(state().hasMore, isFalse);
        expect(state().isFetchingMore, isFalse);
        expect(state().error, isNull);
      },
    );
  }
  test('clear invalidates extra pages and blocks further requests', () async {
    await firstPage();
    final page = search.loadMore();
    await flushSearch();
    search.clear();
    adapter.requests[1].succeed([3]);
    await page;
    await search.loadMore();
    expect(state().results, isEmpty);
    expect(state().offset, 0);
    expect(adapter.requests, hasLength(2));
  });
  test(
    'pagination blocks initial and duplicate loads and retries the same failed offset',
    () async {
      final initial = search.search('하영');
      await search.loadMore();
      await flushSearch();
      expect(adapter.requests, hasLength(1));
      adapter.requests[0].succeed([1, 2], more: true);
      await initial;
      final failedPage = search.loadMore();
      await search.loadMore();
      await flushSearch();
      expect(adapter.requests, hasLength(2));
      adapter.requests[1].fail();
      await failedPage;
      expect(state().offset, 2);
      expect(state().isFetchingMore, isFalse);
      final retry = search.loadMore();
      await flushSearch();
      expect(adapter.requests[2].options.queryParameters['offset'], '2');
      adapter.requests[2].succeed([3]);
      await retry;
      expect(state().results.map((s) => s.id), [1, 2, 3]);
      expect(state().offset, 3);
      expect(state().error, isNull);
      await search.loadMore();
      expect(adapter.requests, hasLength(3));
    },
  );
  for (final fail in [false, true]) {
    test(
      'old suggestion ${fail ? 'failure' : 'success'} cannot replace new suggestions',
      () async {
        final old = suggestions.loadSuggestions('하영');
        final current = suggestions.loadSuggestions('지원');
        await flushSearch();
        adapter.requests[1].succeed([20]);
        await current;
        if (fail) {
          adapter.requests[0].fail();
        } else {
          adapter.requests[0].succeed([10]);
        }
        await old;
        expect(suggestionState().query, '지원');
        expect(suggestionState().suggestions, ['지원 20']);
        expect(suggestionState().isLoading, isFalse);
      },
    );
  }
  test(
    'suggestions clear immediately and ignore the response during a debounce gap',
    () async {
      final old = suggestions.loadSuggestions('하영');
      await flushSearch();
      suggestions.clear();
      adapter.requests[0].succeed([10]);
      await old;
      expect(suggestionState().query, isEmpty);
      expect(suggestionState().suggestions, isEmpty);
      expect(suggestionState().isLoading, isFalse);
    },
  );
  test(
    'identical suggestions share the pending request; a new query clears the old list',
    () async {
      final pending = suggestions.loadSuggestions('하영');
      await suggestions.loadSuggestions('하영');
      await flushSearch();
      expect(adapter.requests, hasLength(1));
      adapter.requests[0].succeed([1]);
      await pending;
      final next = suggestions.loadSuggestions('지원');
      expect(suggestionState().suggestions, isEmpty);
      expect(suggestionState().isLoading, isTrue);
      await flushSearch();
      adapter.requests[1].succeed([]);
      await next;
    },
  );
  test(
    'provider invalidation rejects old search and suggestion responses',
    () async {
      final old = search.search('하영');
      final oldSuggestions = suggestions.loadSuggestions('하영');
      await flushSearch();
      container.invalidate(searchProvider);
      container.invalidate(suggestionProvider);
      search = container.read(searchProvider.notifier);
      suggestions = container.read(suggestionProvider.notifier);
      adapter.requests[0].succeed([1]);
      adapter.requests[1].succeed([1]);
      await Future.wait([old, oldSuggestions]);
      expect(state().results, isEmpty);
      expect(suggestionState().suggestions, isEmpty);
    },
  );
  test('late responses after disposal do not access state', () async {
    final pending = search.search('하영');
    final pendingSuggestions = suggestions.loadSuggestions('하영');
    await flushSearch();
    container.dispose();
    adapter.requests[0].succeed([1]);
    adapter.requests[1].fail();
    await Future.wait([pending, pendingSuggestions]);
  });
}
