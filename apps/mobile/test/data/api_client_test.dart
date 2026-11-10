import 'dart:convert';

import 'package:amar_poribar/data/api/api_client.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('verifyOtp stores the token and later calls send it', () async {
    String? seenAuth;
    final client = ApiClient(
      baseUrl: 'http://x',
      client: MockClient((req) async {
        if (req.url.path == '/v1/auth/otp/verify') {
          return http.Response(jsonEncode({'accessToken': 'tok'}), 200);
        }
        seenAuth = req.headers['authorization'];
        return http.Response(
          jsonEncode({
            'families': [
              {'id': 'f1', 'name': 'Rahman', 'role': 'owner'},
            ],
          }),
          200,
        );
      }),
    );
    await client.verifyOtp('01712345678', '123456');
    final fams = await client.families();
    expect(seenAuth, 'Bearer tok');
    expect(fams.single.name, 'Rahman');
  });

  test('parse sends text and reads drafts (Bangla survives)', () async {
    late Map<String, dynamic> sent;
    final client = ApiClient(
      baseUrl: 'http://x',
      token: 't',
      client: MockClient((req) async {
        sent = jsonDecode(req.body) as Map<String, dynamic>;
        return http.Response.bytes(
          utf8.encode(
            jsonEncode({
              'drafts': [
                {
                  'type': 'expense',
                  'amountPaisa': 85000,
                  'feePaisa': 0,
                  'occurredAt': '2026-11-09T10:00:00Z',
                  'categoryKey': 'bazaar',
                  'accountType': 'cash',
                  'note': 'বাজার',
                  'counterparty': null,
                  'trxId': null,
                  'source': 'ai_text',
                  'confidence': 0.9,
                }
              ],
              'usedAi': true,
            }),
          ),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }),
    );
    final drafts = await client.parse('f1', 'আজ বাজারে ৮৫০ টাকা');
    expect(sent['text'], 'আজ বাজারে ৮৫০ টাকা');
    expect(drafts.single.amountTaka, 850.0);
    expect(drafts.single.note, 'বাজার');
  });

  test('API errors surface the server message and flag 401', () async {
    final client = ApiClient(
      baseUrl: 'http://x',
      client: MockClient(
        (_) async => http.Response(
          jsonEncode({
            'error': {
              'code': 'invalid_otp',
              'message': 'Invalid or expired code',
            },
          }),
          401,
        ),
      ),
    );
    expect(
      () => client.verifyOtp('01712345678', '000000'),
      throwsA(
        isA<ApiException>()
            .having((e) => e.isUnauthorized, 'isUnauthorized', true)
            .having((e) => e.message, 'message', 'Invalid or expired code'),
      ),
    );
  });

  test('network failure becomes a friendly ApiException', () async {
    final client = ApiClient(
      baseUrl: 'http://x',
      client: MockClient((_) async => throw Exception('socket')),
    );
    expect(
      () => client.requestOtp('01712345678'),
      throwsA(isA<ApiException>().having((e) => e.status, 'status', 0)),
    );
  });
}
