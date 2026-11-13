import 'dart:convert';

import 'package:amar_poribar/data/api/api_transport.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// Records the last request and answers with [status] and [body].
class Recorder {
  late http.Request last;
  Object? body;
  int status;
  Recorder(this.body, {this.status = 200});

  String get method => last.method;
  String get url =>
      last.url.path + (last.url.hasQuery ? '?${last.url.query}' : '');
  Object? get sent => last.body.isEmpty ? null : jsonDecode(last.body);

  ApiTransport transport() => ApiTransport(
        MockClient((req) async {
          last = req;
          return http.Response.bytes(
            utf8.encode(jsonEncode(body)),
            status,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }),
        'http://x',
        token: 't',
      );
}

const kId = '00000000-0000-4000-8000-000000000001';
const kTime = '2026-10-05T08:22:00.000Z';
