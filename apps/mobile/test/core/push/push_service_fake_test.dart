import 'package:amar_poribar/core/push/push_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('emit reaches foreground listeners', () async {
    final s = FakePushService(token: 't1');
    await s.init();
    final got = <PushMessage>[];
    s.foreground.listen(got.add);
    s.emit(const PushMessage({'type': 'budget', 'title': 'x'}));
    await Future<void>.delayed(Duration.zero);
    expect(got.single.type, 'budget');
    expect(got.single.title, 'x');
  });

  test('token and refresh', () async {
    final s = FakePushService(token: 't1');
    expect(await s.token(), 't1');
    final refreshed = <String>[];
    s.tokenRefresh.listen(refreshed.add);
    s.refreshToken('t2');
    await Future<void>.delayed(Duration.zero);
    expect(refreshed, ['t2']);
    expect(await s.token(), 't2');
  });

  test('no token when push is unavailable', () async {
    expect(await FakePushService().token(), isNull);
  });
}
