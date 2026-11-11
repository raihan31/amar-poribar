import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/database/database.dart';
import '../../../presentation/providers/providers.dart';
import 'active_family.dart';

/// `YYYY-MM` of the current Asia/Dhaka month.
String currentBudgetMonth() {
  final d = DateTime.now().toUtc().add(const Duration(hours: 6));
  return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}';
}

/// Cached budgets of the active family for this month.
final budgetsProvider = StreamProvider<List<CachedBudget>>((ref) {
  final family = ref.watch(activeFamilyProvider);
  if (family == null) return Stream.value(const <CachedBudget>[]);
  return ref
      .watch(localStoreProvider)
      .watchBudgets(family.id, currentBudgetMonth());
});
