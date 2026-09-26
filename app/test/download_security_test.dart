import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fromis9/services/download_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('downloader enables platform certificate validation', () async {
    MethodCall? initialization;
    const channel = MethodChannel('vn.hunghd/downloader');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
          initialization = call;
          return null;
        });
    addTearDown(() => TestDefaultBinaryMessengerBinding
        .instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null));

    await initDownloadService();
    expect(initialization?.method, 'initialize');
    final args = initialization!.arguments as List<dynamic>;
    expect(args[1], 0); // Debug logging is off.
    expect(args[2], 0); // Android ignoreSsl is off.
  });
}
