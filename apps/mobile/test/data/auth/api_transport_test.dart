import 'dart:convert';

import 'package:amar_poribar/data/api/api_exception.dart';
import 'package:amar_poribar/data/api/api_transport.dart';
import 'package:amar_poribar/data/auth/session_manager.dart';
import 'package:amar_poribar/data/auth/token_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  final now = DateTime.utc(2026, 11, 11, 10);

  SessionManager manager(int Function() onRefresh) => SessionManager(
        store: MemoryTokenStore(
          Tokens(
            access: 'old',
            refresh: 'r1',
            accessExpiresAt: now.add(const Duration(minutes: 10)),
          ),
        ),
        refresh: (r) async {
          onRefresh();
          return Tokens(
            access: 'new',
            refresh: 'r2',
            accessExpiresAt: now.add(const Duration(minutes: 15)),
          );
        },
        now: () => now,
      );

  test('a 401 with valid refresh retries once and succeeds', () async {
    var refreshes = 0;
    final seen = <String?>[];
    final t = ApiTransport(
      MockClient((req) async {
        seen.add(req.headers['authorization']);
        if (req.headers['authorization'] == 'Bearer old') {
          return http.Response(
            '{"error":{"code":"unauthorized","message":"x"}}',
            401,
          );
        }
        return http.Response(jsonEncode({'ok': true}), 200);
      }),
      'http://x',
      session: manager(() => ++refreshes),
    );
    final r = await t.send('GET', '/v1/me') as Map;
    expect(r['ok'], true);
    expect(seen, ['Bearer old', 'Bearer new']);
    expect(refreshes, 1);
  });

  test('a second 401 surfaces as ApiException with code and details', () async {
    var requests = 0;
    final t = ApiTransport(
      MockClient((req) async {
        requests++;
        return http.Response(
          '{"error":{"code":"unauthorized","message":"no","details":{"a":1}}}',
          401,
        );
      }),
      'http://x',
      session: manager(() => 0),
    );
    await expectLater(
      t.send('GET', '/v1/me'),
      throwsA(
        isA<ApiException>()
            .having((e) => e.status, 'status', 401)
            .having((e) => e.code, 'code', 'unauthorized')
            .having((e) => e.details, 'details', {'a': 1}),
      ),
    );
    expect(requests, 2);
  });
}
