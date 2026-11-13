import 'dart:convert';

import 'package:http/http.dart' as http;

import '../auth/session_manager.dart';
import '../auth/token_store.dart';
import 'api_exception.dart';

const _offline =
    'সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না / Cannot reach the server';

/// Decodes a response; throws [ApiException] for `{error:{code,message,details}}`.
dynamic decodeResponse(http.Response res) {
  if (res.statusCode == 204 || res.body.isEmpty) return null;
  final data = jsonDecode(utf8.decode(res.bodyBytes));
  if (res.statusCode >= 400) {
    final err = (data is Map && data['error'] is Map)
        ? data['error'] as Map<String, dynamic>
        : const <String, dynamic>{};
    throw ApiException(
      res.statusCode,
      (err['message'] as String?) ?? 'Request failed (${res.statusCode})',
      code: err['code'] as String?,
      details: err['details'],
    );
  }
  return data;
}

/// Adds `Authorization`, retries once after a refresh on 401.
class ApiTransport {
  final http.Client client;
  final String baseUrl;
  final SessionManager? session;

  /// Static token used when there is no [session] (tests, tools).
  String? token;

  ApiTransport(this.client, this.baseUrl, {this.session, this.token});

  Future<http.Response> _once(
    String method,
    String path,
    Object? body,
    String? bearer,
  ) async {
    final req = http.Request(method, Uri.parse('$baseUrl$path'));
    if (body != null) {
      req.headers['content-type'] = 'application/json';
      req.body = jsonEncode(body);
    }
    if (bearer != null) req.headers['authorization'] = 'Bearer $bearer';
    try {
      return await http.Response.fromStream(await client.send(req));
    } catch (_) {
      throw ApiException(0, _offline);
    }
  }

  Future<dynamic> send(String method, String path, {Object? body}) async {
    final s = session;
    final bearer = s != null ? await s.validAccessToken() : token;
    var res = await _once(method, path, body, bearer);
    if (res.statusCode == 401 && s != null && bearer != null) {
      final fresh = await s.refreshAfterRejection(bearer);
      if (fresh != null && fresh != bearer) {
        res = await _once(method, path, body, fresh);
      }
    }
    return decodeResponse(res);
  }
}

/// `POST /v1/auth/refresh`. Bypasses [ApiTransport] so it cannot loop.
Future<Tokens> refreshTokens(
  http.Client client,
  String baseUrl,
  String refreshToken, {
  DateTime Function()? now,
}) async {
  final req = http.Request('POST', Uri.parse('$baseUrl/v1/auth/refresh'))
    ..headers['content-type'] = 'application/json'
    ..body = jsonEncode({'refreshToken': refreshToken});
  final http.Response res;
  try {
    res = await http.Response.fromStream(await client.send(req));
  } catch (_) {
    throw ApiException(0, _offline);
  }
  final r = decodeResponse(res) as Map<String, dynamic>;
  return tokensFromJson(r, (now ?? DateTime.now)());
}

Tokens tokensFromJson(Map<String, dynamic> r, DateTime now) => Tokens(
      access: r['accessToken'] as String,
      refresh: r['refreshToken'] as String,
      accessExpiresAt:
          now.add(Duration(seconds: (r['expiresIn'] as num).toInt())),
    );
