import 'package:amar_poribar/core/push/device_registrar.dart';
import 'package:amar_poribar/core/push/push_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late FakePushService push;
  late List<String> calls;
  late DeviceRegistrar reg;

  setUp(() {
    push = FakePushService(token: 'tok1');
    calls = [];
    reg = DeviceRegistrar(
      push: push,
      deviceId: () async => 'dev1',
      appVersion: '1.0.0',
      locale: () => 'bn',
      register: (id, body) async => calls.add('PUT $id $body'),
      remove: (id) async => calls.add('DELETE $id'),
    );
  });
  tearDown(() async => reg.stop());

  test('registers on sign-in', () async {
    await reg.onSignedIn();
    expect(calls, [
      'PUT dev1 {platform: android, fcmToken: tok1, appVersion: 1.0.0, locale: bn}',
    ]);
  });

  test('does nothing without a token', () async {
    final r = DeviceRegistrar(
      push: FakePushService(),
      deviceId: () async => 'dev1',
      appVersion: '1',
      locale: () => 'bn',
      register: (id, body) async => calls.add('PUT'),
      remove: (id) async => calls.add('DELETE'),
    );
    await r.onSignedIn();
    expect(calls, isEmpty);
    await r.stop();
  });

  test('re-registers when the token refreshes', () async {
    await reg.onSignedIn();
    push.refreshToken('tok2');
    await Future<void>.delayed(Duration.zero);
    expect(calls, hasLength(2));
    expect(calls.last, contains('fcmToken: tok2'));
  });

  test('deletes on sign-out and stops listening', () async {
    await reg.onSignedIn();
    await reg.onSignedOut();
    expect(calls.last, 'DELETE dev1');
    push.refreshToken('tok3');
    await Future<void>.delayed(Duration.zero);
    expect(calls, hasLength(2));
  });

  test('a failing server does not throw', () async {
    final r = DeviceRegistrar(
      push: push,
      deviceId: () async => 'd',
      appVersion: '1',
      locale: () => 'bn',
      register: (id, body) async => throw Exception('offline'),
      remove: (id) async => throw Exception('offline'),
    );
    await r.onSignedIn();
    await r.onSignedOut();
    await r.stop();
  });
}
