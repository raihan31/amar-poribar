import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../presentation/providers/auth_provider.dart';
import 'ai_api.dart';
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

/// One provider per API class, all sharing the transport of [apiClientProvider].
final authApiProvider =
    Provider<AuthApi>((r) => r.watch(apiClientProvider).auth);
final familyApiProvider =
    Provider<FamilyApi>((r) => r.watch(apiClientProvider).family);
final ledgerApiProvider =
    Provider<LedgerApi>((r) => r.watch(apiClientProvider).ledger);
final aiApiProvider = Provider<AiApi>((r) => r.watch(apiClientProvider).ai);
final budgetApiProvider =
    Provider<BudgetApi>((r) => r.watch(apiClientProvider).budget);
final reportApiProvider =
    Provider<ReportApi>((r) => r.watch(apiClientProvider).report);
final syncApiProvider =
    Provider<SyncApi>((r) => r.watch(apiClientProvider).syncApi);
final commsApiProvider =
    Provider<CommsApi>((r) => r.watch(apiClientProvider).comms);
final notificationApiProvider =
    Provider<NotificationApi>((r) => r.watch(apiClientProvider).notification);
final shoppingApiProvider =
    Provider<ShoppingApi>((r) => r.watch(apiClientProvider).shopping);
final lendingApiProvider =
    Provider<LendingApi>((r) => r.watch(apiClientProvider).lending);
final billingApiProvider =
    Provider<BillingApi>((r) => r.watch(apiClientProvider).billing);
final privacyApiProvider =
    Provider<PrivacyApi>((r) => r.watch(apiClientProvider).privacy);
