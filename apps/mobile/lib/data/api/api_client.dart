import 'package:http/http.dart' as http;

import '../auth/session_manager.dart';
import 'api_transport.dart';

export 'api_exception.dart';

/// Base URL of apps/api. Override with `--dart-define=API_URL=https://...`.
const String kApiUrl =
    String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:4000');

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

  /// Set when this draft came from the offline queue; removing it from the queue is part of confirming it.
  final String? pendingId;

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
    this.pendingId,
  });

  double get amountTaka => amountPaisa / 100;

  TransactionDraft copyWith({String? categoryKey, String? source}) =>
      TransactionDraft(
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
        pendingId: pendingId,
      );

  Map<String, dynamic> toJson() => {
        'type': type,
        'amountPaisa': amountPaisa,
        'feePaisa': feePaisa,
        'occurredAt': occurredAt,
        'categoryKey': categoryKey,
        'accountType': accountType,
        'note': note,
        'counterparty': counterparty,
        'trxId': trxId,
        'source': source,
        'confidence': confidence,
      };

  TransactionDraft withPendingId(String id) => TransactionDraft(
        type: type,
        amountPaisa: amountPaisa,
        feePaisa: feePaisa,
        occurredAt: occurredAt,
        categoryKey: categoryKey,
        accountType: accountType,
        note: note,
        counterparty: counterparty,
        trxId: trxId,
        source: source,
        confidence: confidence,
        pendingId: id,
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

class SyncResponse {
  final String cursor;
  final bool more;
  final int applied;
  final List<({String? id, String reason})> rejected;
  final List<Map<String, dynamic>> changes;
  const SyncResponse(
    this.cursor,
    this.more,
    this.applied,
    this.rejected,
    this.changes,
  );
}

/// Thin client for apps/api. Takes an [http.Client] so tests can inject a mock.
class ApiClient {
  final ApiTransport _t;
  final SessionManager? session;

  ApiClient({
    http.Client? client,
    String baseUrl = kApiUrl,
    String? token,
    this.session,
  }) : _t = ApiTransport(
          client ?? http.Client(),
          baseUrl,
          session: session,
          token: token,
        );

  String? get token => _t.token;
  set token(String? v) => _t.token = v;

  Future<dynamic> _send(String method, String path, {Object? body}) =>
      _t.send(method, path, body: body);

  /// Sends an OTP. Outside production the API also returns the code (`devCode`) for local testing.
  Future<String?> requestOtp(String phone) async {
    final r =
        await _send('POST', '/v1/auth/otp/request', body: {'phone': phone})
            as Map<String, dynamic>;
    return r['devCode'] as String?;
  }

  /// Verifies the OTP and stores the tokens (in the session when there is one).
  Future<String> verifyOtp(String phone, String code) async {
    final r = await _send(
      'POST',
      '/v1/auth/otp/verify',
      body: {'phone': phone, 'code': code},
    ) as Map<String, dynamic>;
    final access = r['accessToken'] as String;
    final refresh = r['refreshToken'] as String?;
    final sm = session;
    if (sm != null && refresh != null) {
      await sm.setTokens(
        tokensFromJson({...r, 'refreshToken': refresh}, sm.now()),
      );
    } else {
      token = access;
    }
    return access;
  }

  Future<List<FamilyInfo>> families() async {
    final r = await _send('GET', '/v1/me') as Map<String, dynamic>;
    return (r['families'] as List)
        .map(
          (f) => FamilyInfo(
            f['id'] as String,
            f['name'] as String,
            f['role'] as String,
          ),
        )
        .toList();
  }

  Future<FamilyInfo> createFamily(String name) async {
    final r = await _send('POST', '/v1/families', body: {'name': name})
        as Map<String, dynamic>;
    return FamilyInfo(r['id'] as String, r['name'] as String, 'owner');
  }

  /// Text or a pasted MFS SMS to drafts (SRS FR-AI-01, FR-AI-02).
  Future<List<TransactionDraft>> parse(
    String familyId,
    String text, {
    DateTime? now,
  }) async {
    final r = await _send(
      'POST',
      '/v1/families/$familyId/ai/parse',
      body: {
        'text': text,
        'now': (now ?? DateTime.now()).toUtc().toIso8601String(),
      },
    ) as Map<String, dynamic>;
    return (r['drafts'] as List)
        .map((d) => TransactionDraft.fromJson(d as Map<String, dynamic>))
        .toList();
  }

  Future<MonthlySummary> summary(
    String familyId, {
    String locale = 'bn',
  }) async {
    final r =
        await _send('GET', '/v1/families/$familyId/ai/summary?locale=$locale')
            as Map<String, dynamic>;
    return MonthlySummary(
      r['text'] as String,
      r['speechText'] as String,
      r['usedAi'] as bool,
    );
  }

  /// Exchange transaction changes with the server (SRS §4.3.1). [cursor] is the value from the last response.
  Future<SyncResponse> sync(
    String familyId,
    String nodeId,
    String? cursor,
    List<Map<String, dynamic>> changes,
  ) async {
    final r = await _send(
      'POST',
      '/v1/families/$familyId/sync',
      body: {
        'nodeId': nodeId,
        'cursor': cursor,
        'changes': {'transactions': changes},
      },
    ) as Map<String, dynamic>;
    return SyncResponse(
      r['cursor'] as String,
      r['more'] as bool,
      (r['applied'] as num).toInt(),
      [
        for (final x in r['rejected'] as List)
          (id: x['id'] as String?, reason: x['reason'] as String),
      ],
      [
        for (final c
            in (r['changes'] as Map<String, dynamic>)['transactions'] as List)
          Map<String, dynamic>.from(c as Map),
      ],
    );
  }

  Future<List<Map<String, dynamic>>> categories(String familyId) async => [
        for (final c
            in await _send('GET', '/v1/families/$familyId/categories') as List)
          Map<String, dynamic>.from(c as Map),
      ];

  Future<List<Map<String, dynamic>>> accounts(String familyId) async => [
        for (final c
            in await _send('GET', '/v1/families/$familyId/accounts') as List)
          Map<String, dynamic>.from(c as Map),
      ];

  /// This month's budgets with spend and 80%/100% level.
  Future<List<Map<String, dynamic>>> budgets(String familyId) async {
    final r = await _send('GET', '/v1/families/$familyId/budgets')
        as Map<String, dynamic>;
    return [
      for (final b in r['budgets'] as List) Map<String, dynamic>.from(b as Map),
    ];
  }
}
