import 'package:amar_poribar/data/api/api_exception.dart';
import 'package:amar_poribar/data/auth/session_manager.dart';
import 'package:amar_poribar/data/auth/token_store.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final t0 = DateTime.utc(2026, 11, 11, 10);
  late DateTime clock;
  late MemoryTokenStore store;
  late int calls;
  late Future<Tokens> Function(String) onRefresh;
  late SessionManager sm;
  var expiredCalls = 0;

  Tokens tokens(String a, String r, int secs) => Tokens(
        access: a,
        refresh: r,
        accessExpiresAt: clock.add(Duration(seconds: secs)),
      );

  setUp(() {
    clock = t0;
    calls = 0;
    expiredCalls = 0;
    store = MemoryTokenStore(tokens('a1', 'r1', 900));
    onRefresh = (r) async => tokens('a2', 'r2', 900);
    sm = SessionManager(
      store: store,
      refresh: (r) {
        calls++;
        return onRefresh(r);
      },
      now: () => clock,
      onSessionExpired: () => expiredCalls++,
    );
  });

  test('refreshes only when under 60 s are left', () async {
    expect(await sm.validAccessToken(), 'a1');
    expect(calls, 0);
    clock = t0.add(const Duration(seconds: 841)); // 59 s left
    expect(await sm.validAccessToken(), 'a2');
    expect(calls, 1);
    expect((await store.read())!.refresh, 'r2');
  });

  test('ten parallel calls cause one refresh request', () async {
    clock = t0.add(const Duration(seconds: 890));
    onRefresh = (r) async {
      await Future<void>.delayed(const Duration(milliseconds: 20));
      return tokens('a2', 'r2', 900);
    };
    final all = await Future.wait(
      List.generate(10, (_) => sm.validAccessToken()),
    );
    expect(calls, 1);
    expect(all.toSet(), {'a2'});
  });

  test('refresh 401 expires the session and clears tokens', () async {
    clock = t0.add(const Duration(seconds: 890));
    onRefresh =
        (r) async => throw ApiException(401, 'no', code: 'unauthorized');
    final states = <SessionState>[];
    sm.states.listen(states.add);
    expect(await sm.validAccessToken(), isNull);
    await Future<void>.delayed(Duration.zero);
    expect(states, [SessionState.expired]);
    expect(await store.read(), isNull);
    expect(expiredCalls, 1);
  });

  test('reuse error session_revoked expires the session', () async {
    clock = t0.add(const Duration(seconds: 890));
    onRefresh =
        (r) async => throw ApiException(403, 'reuse', code: 'session_revoked');
    expect(await sm.validAccessToken(), isNull);
    expect(sm.state, SessionState.expired);
    expect(await store.read(), isNull);
  });

  test('offline refresh keeps the session', () async {
    clock = t0.add(const Duration(seconds: 890));
    onRefresh = (r) async => throw ApiException(0, 'offline');
    expect(await sm.validAccessToken(), 'a1');
    expect(await store.read(), isNotNull);
  });
}
