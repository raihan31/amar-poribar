import 'dart:convert';

import 'package:http/http.dart' as http;

/// Base URL of apps/api. Override with `--dart-define=API_URL=https://...`.
const String kApiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:4000');

class ApiException implements Exception {
  final int status;
  final String message;
  ApiException(this.status, this.message);

  bool get isUnauthorized => status == 401;

  @override
  String toString() => message;
}

/// A transaction proposed by the parser, waiting for the user to confirm (SRS FR-AI-05).
class TransactionDraft {
  final String type; // expense | income | transfer
  final int amountPaisa;
  final int feePaisa;
  final String occurredAt;
  final String? categoryKey;
  final String? accountType;
  final String note;
  final String? counterparty;
  final String? trxId;
  final String source;
  final double confidence;

  const TransactionDraft({
    required this.type,
    required this.amountPaisa,
    required this.feePaisa,
    required this.occurredAt,
    required this.categoryKey,
    required this.accountType,
    required this.note,
    required this.counterparty,
    required this.trxId,
    required this.source,
    required this.confidence,
  });

  double get amountTaka => amountPaisa / 100;

  TransactionDraft copyWith({String? categoryKey, String? source}) => TransactionDraft(
        type: type,
        amountPaisa: amountPaisa,
        feePaisa: feePaisa,
        occurredAt: occurredAt,
        categoryKey: categoryKey ?? this.categoryKey,
        accountType: accountType,
        note: note,
        counterparty: counterparty,
        trxId: trxId,
        source: source ?? this.source,
        confidence: confidence,
      );

  factory TransactionDraft.fromJson(Map<String, dynamic> j) => TransactionDraft(
        type: j['type'] as String,
        amountPaisa: (j['amountPaisa'] as num).toInt(),
        feePaisa: ((j['feePaisa'] ?? 0) as num).toInt(),
        occurredAt: j['occurredAt'] as String,
        categoryKey: j['categoryKey'] as String?,
        accountType: j['accountType'] as String?,
        note: (j['note'] ?? '') as String,
        counterparty: j['counterparty'] as String?,
        trxId: j['trxId'] as String?,
        source: (j['source'] ?? 'ai_text') as String,
        confidence: ((j['confidence'] ?? 0) as num).toDouble(),
      );
}

class FamilyInfo {
  final String id;
  final String name;
  final String role;
  const FamilyInfo(this.id, this.name, this.role);
}

class MonthlySummary {
  final String text;
  final String speechText;
  final bool usedAi;
  const MonthlySummary(this.text, this.speechText, this.usedAi);
}

/// Thin client for apps/api. Takes an [http.Client] so tests can inject a mock.
class ApiClient {
  final http.Client _http;
  final String baseUrl;
  String? token;

  ApiClient({http.Client? client, this.baseUrl = kApiUrl, this.token}) : _http = client ?? http.Client();

  Future<dynamic> _send(String method, String path, {Object? body}) async {
    final req = http.Request(method, Uri.parse('$baseUrl$path'));
    if (body != null) {
      req.headers['content-type'] = 'application/json';
      req.body = jsonEncode(body);
    }
    if (token != null) req.headers['authorization'] = 'Bearer $token';
    final http.Response res;
    try {
      res = await http.Response.fromStream(await _http.send(req));
    } catch (_) {
      throw ApiException(0, 'সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না / Cannot reach the server');
    }
    if (res.statusCode == 204 || res.body.isEmpty) return null;
    final data = jsonDecode(utf8.decode(res.bodyBytes));
    if (res.statusCode >= 400) {
      final msg = (data is Map && data['error'] is Map) ? data['error']['message'] as String? : null;
      throw ApiException(res.statusCode, msg ?? 'Request failed (${res.statusCode})');
    }
    return data;
  }

  /// Sends an OTP. Outside production the API also returns the code (`devCode`) for local testing.
  Future<String?> requestOtp(String phone) async {
    final r = await _send('POST', '/v1/auth/otp/request', body: {'phone': phone}) as Map<String, dynamic>;
    return r['devCode'] as String?;
  }

  /// Verifies the OTP and stores the access token on this client.
  Future<String> verifyOtp(String phone, String code) async {
    final r = await _send('POST', '/v1/auth/otp/verify', body: {'phone': phone, 'code': code}) as Map<String, dynamic>;
    token = r['accessToken'] as String;
    return token!;
  }

  Future<List<FamilyInfo>> families() async {
    final r = await _send('GET', '/v1/me') as Map<String, dynamic>;
    return (r['families'] as List)
        .map((f) => FamilyInfo(f['id'] as String, f['name'] as String, f['role'] as String))
        .toList();
  }

  Future<FamilyInfo> createFamily(String name) async {
    final r = await _send('POST', '/v1/families', body: {'name': name}) as Map<String, dynamic>;
    return FamilyInfo(r['id'] as String, r['name'] as String, 'owner');
  }

  /// Text or a pasted MFS SMS to drafts (SRS FR-AI-01, FR-AI-02).
  Future<List<TransactionDraft>> parse(String familyId, String text, {DateTime? now}) async {
    final r = await _send('POST', '/v1/families/$familyId/ai/parse',
        body: {'text': text, 'now': (now ?? DateTime.now()).toUtc().toIso8601String()}) as Map<String, dynamic>;
    return (r['drafts'] as List).map((d) => TransactionDraft.fromJson(d as Map<String, dynamic>)).toList();
  }

  Future<MonthlySummary> summary(String familyId, {String locale = 'bn'}) async {
    final r = await _send('GET', '/v1/families/$familyId/ai/summary?locale=$locale') as Map<String, dynamic>;
    return MonthlySummary(r['text'] as String, r['speechText'] as String, r['usedAi'] as bool);
  }
}
