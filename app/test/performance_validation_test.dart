import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fromis9/services/api_client.dart';
import 'package:fromis9/views/video/video_list_view.dart';
import 'package:fromis9/views/video/video_widgets.dart';
import 'package:visibility_detector/visibility_detector.dart';
import 'app_validation_test.dart' show DeferredVideoAdapter, flush;

void main() {
  for (final category in ['variety', 'shorts']) {
    testWidgets('$category large month mounts only nearby video rows', (
      tester,
    ) async {
      final old = dio.httpClientAdapter;
      final oldTransformer = dio.transformer;
      dio.transformer = SyncTransformer();
      addTearDown(() => dio.transformer = oldTransformer);
      final adapter = DeferredVideoAdapter();
      dio.httpClientAdapter = adapter;
      addTearDown(() => dio.httpClientAdapter = old);
      VisibilityDetectorController.instance.updateInterval = Duration.zero;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(body: VideoListView(category: category)),
        ),
      );
      await tester.pump(const Duration(milliseconds: 100));
      adapter.finish(0, count: 600);
      await flush(tester);
      final cards = find.byType(category == 'shorts' ? ShortsCard : VideoCard);
      final mounted = cards.evaluate().length;
      debugPrint('$category 600 video month; mounted cards: $mounted');
      expect(mounted, greaterThan(0));
      expect(mounted, lessThan(30));
      await tester.drag(find.byType(ListView).first, const Offset(0, -1800));
      await flush(tester);
      expect(cards.evaluate().length, greaterThan(0));
      expect(cards.evaluate().length, lessThan(30));
      await tester.pumpWidget(const SizedBox());
      await tester.pump();
      expect(tester.takeException(), isNull);
    });
  }
}
