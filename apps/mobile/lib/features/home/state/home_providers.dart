import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ui_scale.dart';
import '../../../data/database/database.dart' show CachedBudget;
import '../../../domain/models/member.dart';
import '../../../presentation/providers/auth_provider.dart';
import '../../../presentation/providers/providers.dart';
import '../../family/state/active_family.dart';
import '../../family/state/budgets_provider.dart';
import '../../family/state/family_providers.dart';
import '../../transactions/data/local_transaction_repository.dart';
import '../data/home_repository.dart';

/// Where "now" comes from; tests override it.
final homeClockProvider = Provider<DateTime Function()>((_) => DateTime.now);

/// The real repository (local data); tests override it with [FakeHomeRepository].
final homeRepositoryProvider = Provider<HomeRepository>(
  (ref) => LocalHomeRepository(
    LocalTransactionRepository(
      ref.watch(localStoreProvider),
      now: ref.watch(homeClockProvider),
    ),
  ),
);

/// Asia/Dhaka wall clock (UTC+6, no daylight saving).
DateTime dhakaNow(DateTime Function() clock) =>
    clock().toUtc().add(const Duration(hours: 6));

/// `YYYY-MM` of the current Asia/Dhaka month.
final homeMonthProvider = Provider<String>((ref) {
  final d = dhakaNow(ref.watch(homeClockProvider));
  return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}';
});

/// This month's totals and the change against last month, straight from the local database.
final homeSummaryProvider = StreamProvider<HomeSummary>((ref) {
  final family = ref.watch(activeFamilyProvider);
  if (family == null) {
    return Stream.value(
      const HomeSummary(
        current: MonthTotals(),
        previous: MonthTotals(),
      ),
    );
  }
  return ref.watch(homeRepositoryProvider).watchSummary(
        familyId: family.id,
        month: ref.watch(homeMonthProvider),
        viewerUserId: ref.watch(myUserIdProvider).valueOrNull,
      );
});

/// Category names by id, for naming a budget.
final categoryNamesProvider = FutureProvider<Map<String, String>>((ref) async {
  final cats = await ref.watch(localStoreProvider).categories();
  return {for (final c in cats) c.id: c.nameBn};
});

/// The budget Home warns about.
class TopBudgetWarning {
  const TopBudgetWarning({
    required this.budget,
    required this.name,
    required this.percent,
  });

  final CachedBudget budget;

  /// Category name, or "মোট" for the overall budget.
  final String name;

  /// Whole percent of the limit already spent.
  final int percent;

  bool get exceeded => budget.level == 'exceeded';
}

/// "বাজার" -> "বাজারের", "মুদি" -> "মুদির".
String genitive(String name) {
  const vowelEnds = 'ািীুূেোঅআইঈউঊএঐওঔ';
  final last = String.fromCharCode(name.runes.last);
  return vowelEnds.contains(last) ? '$nameর' : '$nameের';
}

const _levelRank = {'ok': 0, 'warning': 1, 'exceeded': 2};

/// The budget with the highest level (ties: the fuller one); null when every budget is ok.
///
/// Reads the cached budgets from the local database (a drift stream). `defaultFakes` overrides this
/// with null so full-app tests do not open a stream; a test that seeds budgets overrides it back with
/// `topBudgetWarningProvider.overrideWith(realTopBudgetWarning)`.
final topBudgetWarningProvider =
    Provider<TopBudgetWarning?>(realTopBudgetWarning);

/// The real computation behind [topBudgetWarningProvider].
TopBudgetWarning? realTopBudgetWarning(Ref ref) {
  final budgets = ref.watch(budgetsProvider).valueOrNull ?? const [];
  final names = ref.watch(categoryNamesProvider).valueOrNull ?? const {};
  CachedBudget? best;
  int ratio(CachedBudget b) =>
      b.limitPaisa <= 0 ? 0 : b.spentPaisa * 1000 ~/ b.limitPaisa;
  for (final b in budgets) {
    final r = _levelRank[b.level] ?? 0;
    if (r == 0) continue;
    if (best == null) {
      best = b;
      continue;
    }
    final br = _levelRank[best.level] ?? 0;
    if (r > br || (r == br && ratio(b) > ratio(best))) best = b;
  }
  if (best == null) return null;
  final cat = best.categoryId == null ? null : names[best.categoryId];
  final name = cat == null ? 'মোট' : genitive(cat);
  return TopBudgetWarning(
    budget: best,
    name: name,
    percent:
        best.limitPaisa <= 0 ? 0 : best.spentPaisa * 100 ~/ best.limitPaisa,
  );
}

/// Who gets the "বাজেট শেষ" buzz: an admin other than me, else any other owner or admin.
final budgetRecipientProvider = Provider<Member?>((ref) {
  final members = ref.watch(membersProvider).valueOrNull ?? const [];
  final me = ref.watch(myUserIdProvider).valueOrNull;
  final others =
      members.where((m) => m.userId != me && m.role.canManageMembers);
  if (others.isEmpty) return null;
  return others.firstWhere(
    (m) => m.role.name == 'admin',
    orElse: () => others.first,
  );
});

/// Recent chat voice notes. Empty until the chat feature (T-MOB-37) provides them.
final chatActivityProvider = Provider<List<ActivityItem>>((_) => const []);

final _latestExpensesProvider = StreamProvider<List<ActivityItem>>((ref) {
  final family = ref.watch(activeFamilyProvider);
  if (family == null) return Stream.value(const <ActivityItem>[]);
  return ref.watch(homeRepositoryProvider).watchLatestExpenses(
        familyId: family.id,
        viewerUserId: ref.watch(myUserIdProvider).valueOrNull,
      );
});

/// The newest two events from chat voice notes and expenses, newest first.
final recentActivityProvider = Provider<List<ActivityItem>>((ref) {
  final all = [
    ...ref.watch(chatActivityProvider),
    ...ref.watch(_latestExpensesProvider).valueOrNull ?? const <ActivityItem>[],
  ]..sort((a, b) => b.at.compareTo(a.at));
  return all.take(2).toList();
});

enum HomeVariant { normal, simple }

/// Simple mode swaps the whole screen (T-MOB-50).
final homeVariantProvider = Provider<HomeVariant>(
  (ref) => ref.watch(uiScaleProvider) == UiScale.simple
      ? HomeVariant.simple
      : HomeVariant.normal,
);

/// True while the device has no connection (T-MOB-73 provides the real signal).
final homeOfflineProvider = Provider<bool>((_) => false);

/// Pull to refresh: runs a sync of the active family (T-MOB-48 replaces this with the sync engine).
final homeRefreshProvider = Provider<Future<void> Function()>((ref) {
  return () async {
    final family = ref.read(activeFamilyProvider);
    if (family == null) return;
    try {
      await ref.read(syncServiceProvider).sync(family.id);
    } catch (_) {
      // Offline or server trouble: the screen keeps showing local data.
    }
  };
});
