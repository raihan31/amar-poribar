import 'package:http/http.dart' as http;

import '../../domain/models/api/draft.dart';
import '../../domain/models/api/me.dart';
import '../../domain/models/api/report.dart';
import '../../domain/models/api/sync.dart';
import '../auth/session_manager.dart';
import 'ai_api.dart';
import 'api_transport.dart';
import 'auth_api.dart';
import 'billing_api.dart';
import 'budget_api.dart';
import 'comms_api.dart';
import 'family_api.dart';
import 'ledger_api.dart';
import 'lending_api.dart';
import 'notification_api.dart';
import 'privacy_api.dart';
import 'report_api.dart';
import 'shopping_api.dart';
import 'sync_api.dart';

export '../../domain/models/api/draft.dart' show TransactionDraft;
export '../../domain/models/api/me.dart' show FamilyInfo;
export '../../domain/models/api/report.dart' show MonthlySummary;
export '../../domain/models/api/sync.dart' show SyncResponse;
export 'api_exception.dart';

/// Base URL of apps/api. Override with `--dart-define=API_URL=https://...`.
const String kApiUrl =
    String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:4000');

/// Facade over the per-module API classes, so screens keep one dependency.
/// Takes an [http.Client] so tests can inject a mock. Each class is a thin
/// layer over the shared [ApiTransport] (auth header, refresh, error mapping).
class ApiClient {
  final ApiTransport transport;
  final SessionManager? session;

  final AuthApi auth;
  final FamilyApi family;
  final LedgerApi ledger;
  final AiApi ai;
  final BudgetApi budget;
  final ReportApi report;
  final SyncApi syncApi;
  final CommsApi comms;
  final NotificationApi notification;
  final ShoppingApi shopping;
  final LendingApi lending;
  final BillingApi billing;
  final PrivacyApi privacy;

  ApiClient({
    http.Client? client,
    String baseUrl = kApiUrl,
    String? token,
    SessionManager? session,
  }) : this._(
          ApiTransport(
            client ?? http.Client(),
            baseUrl,
            session: session,
            token: token,
          ),
        );

  ApiClient._(this.transport)
      : session = transport.session,
        auth = AuthApi(transport),
        family = FamilyApi(transport),
        ledger = LedgerApi(transport),
        ai = AiApi(transport),
        budget = BudgetApi(transport),
        report = ReportApi(transport),
        syncApi = SyncApi(transport),
        comms = CommsApi(transport),
        notification = NotificationApi(transport),
        shopping = ShoppingApi(transport),
        lending = LendingApi(transport),
        billing = BillingApi(transport),
        privacy = PrivacyApi(transport);

  String? get token => transport.token;
  set token(String? v) => transport.token = v;

  Future<String?> requestOtp(String phone) => auth.requestOtp(phone);

  Future<String> verifyOtp(String phone, String code) =>
      auth.verifyOtp(phone, code);

  Future<List<FamilyInfo>> families() => family.families();

  Future<FamilyInfo> createFamily(String name) async {
    final f = await family.createFamily(name);
    return FamilyInfo(f.id, f.name, 'owner');
  }

  Future<List<TransactionDraft>> parse(
    String familyId,
    String text, {
    DateTime? now,
  }) async =>
      (await ai.parse(familyId, text, now: now)).drafts;

  Future<MonthlySummary> summary(String familyId, {String locale = 'bn'}) =>
      ai.summary(familyId, locale: locale);

  Future<SyncResponse> sync(
    String familyId,
    String nodeId,
    String? cursor,
    List<Map<String, dynamic>> changes,
  ) =>
      syncApi.sync(familyId, nodeId, cursor, changes);

  Future<List<Map<String, dynamic>>> categories(String familyId) async => [
        for (final c in await ledger.categories(familyId)) c.toJson(),
      ];

  Future<List<Map<String, dynamic>>> accounts(String familyId) async => [
        for (final a in await ledger.accounts(familyId)) a.toJson(),
      ];

  /// Budgets with spend and 80%/100% level for [month] (`YYYY-MM`, default this month), each row
  /// carrying its month and a stable id so it can be cached.
  Future<List<Map<String, dynamic>>> budgets(
    String familyId, {
    String? month,
  }) async {
    final list = await budget.budgets(familyId, month: month);
    return [
      for (final b in list.budgets)
        {
          ...b.toJson(),
          'month': list.month,
          'id': '$familyId:${list.month}:${b.categoryId ?? 'overall'}',
        },
    ];
  }

  /// Members as the cache stores them: only the last three digits of the phone are kept.
  Future<List<Map<String, dynamic>>> members(String familyId) async => [
        for (final m in await family.members(familyId))
          {
            'userId': m.userId,
            'name': m.name ?? '',
            'role': m.role,
            'phoneLast3': m.phone.length > 3
                ? m.phone.substring(m.phone.length - 3)
                : m.phone,
          },
      ];

  /// Plan limits and flags of the family's subscription.
  Future<Map<String, dynamic>> entitlements(String familyId) async =>
      (await billing.subscription(familyId)).toJson();
}
