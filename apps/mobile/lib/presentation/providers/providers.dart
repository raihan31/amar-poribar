import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/database/local_store.dart';
import '../../domain/models/enums.dart';

/// The on-device store. `main.dart` opens the database and overrides this; tests override it with an
/// in-memory one.
final localStoreProvider = Provider<LocalStore>((ref) {
  throw StateError(
      'localStoreProvider must be overridden with an opened LocalStore');
});

class AppState {
  final Role activeRole;
  final double monthlyBudget;
  final double totalIncome;
  final double totalExpense;

  /// Latest entries for the dashboard list.
  final List<Map<String, dynamic>> recent;

  const AppState({
    this.activeRole = Role.father, // Default admin view
    this.monthlyBudget = 100000.0,
    this.totalIncome = 0,
    this.totalExpense = 0,
    this.recent = const [],
  });

  AppState copyWith({
    Role? activeRole,
    double? monthlyBudget,
    double? totalIncome,
    double? totalExpense,
    List<Map<String, dynamic>>? recent,
  }) {
    return AppState(
      activeRole: activeRole ?? this.activeRole,
      monthlyBudget: monthlyBudget ?? this.monthlyBudget,
      totalIncome: totalIncome ?? this.totalIncome,
      totalExpense: totalExpense ?? this.totalExpense,
      recent: recent ?? this.recent,
    );
  }
}

/// Dashboard state backed by the local database: totals for this month and the latest entries.
class AppStateNotifier extends StateNotifier<AppState> {
  final LocalStore store;
  AppStateNotifier(this.store) : super(const AppState()) {
    reload();
  }

  void setRole(Role role) {
    state = state.copyWith(activeRole: role);
  }

  Future<void> addExpense(double taka,
      {String? note, String? categoryId, String source = 'manual'}) async {
    await store.addTransaction(
      type: 'expense',
      amountPaisa: (taka * 100).round(),
      note: note,
      categoryId: categoryId,
      source: source,
    );
    await reload();
  }

  Future<void> addIncome(double taka,
      {String? note, String? categoryId, String source = 'manual'}) async {
    await store.addTransaction(
      type: 'income',
      amountPaisa: (taka * 100).round(),
      note: note,
      categoryId: categoryId,
      source: source,
    );
    await reload();
  }

  Future<void> reload() async {
    // Months are Asia/Dhaka (UTC+6) calendar months.
    final dhaka = DateTime.now().toUtc().add(const Duration(hours: 6));
    final start = DateTime.utc(dhaka.year, dhaka.month)
        .subtract(const Duration(hours: 6));
    final end = DateTime.utc(dhaka.year, dhaka.month + 1)
        .subtract(const Duration(hours: 6));
    final totals = await store.totals(start, end);
    final cats = {for (final c in await store.categories()) c.id: c.nameBn};
    final rows = await store.recent(limit: 20);
    if (!mounted) return;
    state = state.copyWith(
      totalIncome: totals.incomePaisa / 100,
      totalExpense: totals.expensePaisa / 100,
      recent: [
        for (final r in rows)
          {
            'type': r.type,
            'category': cats[r.categoryId] ?? r.note ?? 'অন্যান্য',
            'amount': r.amountPaisa / 100,
            'date': r.occurredAt.substring(0, 10),
          },
      ],
    );
  }
}

final appStateProvider =
    StateNotifierProvider<AppStateNotifier, AppState>((ref) {
  return AppStateNotifier(ref.watch(localStoreProvider));
});

final recentTransactionsProvider = Provider<List<Map<String, dynamic>>>((ref) {
  return ref.watch(appStateProvider.select((s) => s.recent));
});
