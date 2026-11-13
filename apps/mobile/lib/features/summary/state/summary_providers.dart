import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/api/api_providers.dart';
import '../../../presentation/providers/providers.dart';
import '../../family/state/active_family.dart';
import '../../family/state/family_providers.dart';
import '../../home/state/home_providers.dart';
import '../../transactions/state/add_expense_controller.dart';
import '../data/summary_repository.dart';

/// The real repository; tests override it with `FakeSummaryRepository`.
final summaryRepositoryProvider = Provider<SummaryRepository>(
  (ref) => ApiSummaryRepository(
    ref.watch(aiApiProvider),
    ref.watch(localStoreProvider),
    ref.watch(transactionRepositoryProvider),
    familyId: () => ref.read(activeFamilyProvider)?.id,
    viewerUserId: () => ref.read(myUserIdProvider).valueOrNull,
  ),
);

/// The summary of the current month (Asia/Dhaka), in Bangla.
final monthlySummaryProvider = FutureProvider.autoDispose<MonthlySummary>((
  ref,
) {
  final month = ref.watch(homeMonthProvider);
  return ref.watch(summaryRepositoryProvider).load(month, const Locale('bn'));
});
