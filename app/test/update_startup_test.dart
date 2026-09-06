import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:fromis9/views/splash_view.dart';

class TrackingClient extends MockClient {
  TrackingClient(super.handler);
  bool closed = false;
  @override
  void close() {
    closed = true;
    super.close();
  }
}

http.Response update({required bool mandatory}) => http.Response(
  jsonEncode({
    'versionCode': 9999,
    'versionName': 'test',
    'downloadUrl': 'https://example.test/test.apk',
    'mandatory': mandatory,
    'sha256': 'test',
    'size': 100,
  }),
  200,
);

void main() {
  setUp(() {
    PackageInfo.setMockInitialValues(
      appName: 'fromlog',
      packageName: 'com.caadiq.fromlog',
      version: '2.0.0',
      buildNumber: '2127',
      buildSignature: '',
    );
  });

  Future<void> boot(
    WidgetTester tester,
    TrackingClient client,
    Future<void> Function() verify,
  ) async {
    final router = GoRouter(
      initialLocation: '/splash',
      routes: [
        GoRoute(path: '/splash', builder: (_, _) => const SplashGate()),
        GoRoute(
          path: '/',
          builder: (_, _) => const Scaffold(body: Text('HOME')),
        ),
      ],
    );
    await http.runWithClient(() async {
      await tester.pumpWidget(MaterialApp.router(routerConfig: router));
      await tester.pump();
      await verify();
      await tester.pumpWidget(const SizedBox.shrink());
    }, () => client);
    router.dispose();
  }

  testWidgets(
    'unresponsive update server releases startup after five seconds',
    (tester) async {
      final pending = Completer<http.Response>();
      final client = TrackingClient((_) => pending.future);
      await boot(tester, client, () async {
        await tester.pump(const Duration(seconds: 4));
        expect(find.text('HOME'), findsNothing);
        expect(client.closed, isFalse);
        await tester.pump(const Duration(seconds: 1));
        await tester.pumpAndSettle();
        expect(find.text('HOME'), findsOneWidget);
        expect(client.closed, isTrue);
        // A late mandatory response must not reopen a dialog after entry.
        pending.complete(update(mandatory: true));
        await tester.pumpAndSettle();
        expect(find.text('필수 업데이트입니다.'), findsNothing);
        expect(find.text('HOME'), findsOneWidget);
      });
    },
  );

  for (final status in [204, 500]) {
    testWidgets(
      'HTTP $status permits startup without waiting for the timeout',
      (tester) async {
        final client = TrackingClient((_) async => http.Response('', status));
        await boot(tester, client, () async {
          await tester.pumpAndSettle();
          expect(find.text('HOME'), findsOneWidget);
          expect(client.closed, isTrue);
        });
      },
    );
  }

  testWidgets('confirmed mandatory update continues blocking startup', (
    tester,
  ) async {
    final client = TrackingClient((_) async => update(mandatory: true));
    await boot(tester, client, () async {
      await tester.pumpAndSettle();
      expect(find.text('필수 업데이트입니다.'), findsOneWidget);
      expect(find.text('HOME'), findsNothing);
      await tester.pump(const Duration(seconds: 6));
      await tester.tapAt(const Offset(5, 5));
      await tester.pumpAndSettle();
      expect(find.text('필수 업데이트입니다.'), findsOneWidget);
      expect(find.text('HOME'), findsNothing);
      expect(client.closed, isTrue);
    });
  });

  testWidgets('optional update can be dismissed to enter the app', (
    tester,
  ) async {
    final client = TrackingClient((_) async => update(mandatory: false));
    await boot(tester, client, () async {
      await tester.pumpAndSettle();
      expect(find.text('새 버전 test'), findsOneWidget);
      await tester.tapAt(const Offset(5, 5));
      await tester.pumpAndSettle();
      expect(find.text('HOME'), findsOneWidget);
      expect(client.closed, isTrue);
    });
  });
}
