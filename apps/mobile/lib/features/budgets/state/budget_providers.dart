import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/api/api_providers.dart';
import '../../../data/sync/reference_data_sync.dart';
import '../../../presentation/providers/auth_provider.dart';
import '../../../presentation/providers/providers.dart';
import '../../family/state/active_family.dart';
import '../../family/state/family_providers.dart';
import '../../home/state/home_providers.dart';
import '../data/budget_repository.dart';
import 'spoken_alert_controller.dart';

/// The budgets of the active family. Tests override it with [FakeBudgetRepository].
final budgetRepositoryProvider = Provider<BudgetRepository>((ref) {
  final family = ref.watch(activeFamilyProvider);
  if (family == null) return const EmptyBudgetRepository();
  final store = ref.watch(localStoreProvider);
  return ApiBudgetRepository(
    store,
    ref.watch(budgetApiProvider),
    family.id,
    refresh: () async {
      await ReferenceDataSync(
        ref.read(apiClientProvider),
        store,
      ).refresh(family.id);
    },
  );
});

/// This month's budgets with spend and level.
final budgetStatusesProvider = StreamProvider<List<BudgetStatus>>(
  (ref) =>
      ref.watch(budgetRepositoryProvider).watch(ref.watch(homeMonthProvider)),
);

final festivalBudgetsProvider = FutureProvider<List<FestivalBudget>>(
  (ref) => ref.watch(budgetRepositoryProvider).festivals(),
);

/// Only Owner and Admin change budgets (FR-BUD-01); everyone else reads them.
final canEditBudgetsProvider = Provider<bool>(
  (ref) => ref.watch(currentRoleProvider).canEditAll,
);

/// The controller behind the alerts. It does not listen until [spokenAlertWiringProvider] starts it.
final spokenAlertControllerProvider = Provider<SpokenAlertController>((ref) {
  final store = ref.watch(localStoreProvider);
  final repo = ref.watch(budgetRepositoryProvider);
  final clock = ref.read(homeClockProvider);
  final c = SpokenAlertController(
    watch: repo.watch,
    voice: ref.watch(voiceServiceProvider),
    getMeta: store.getMeta,
    setMeta: store.setMeta,
    month: () {
      final d = dhakaNow(clock);
      return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}';
    },
  );
  ref.onDispose(c.stop);
  return c;
});

/// Starts spoken alerts for the running app: after every change of the cached budgets and when the
/// app is foregrounded. Watch it once from the app widget.
final spokenAlertWiringProvider = Provider<void>((ref) {
  if (ref.watch(activeFamilyProvider) == null) return;
  ref.watch(spokenAlertControllerProvider).start();
});
