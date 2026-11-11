import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/money/money.dart';
import '../../data/database/local_store.dart';

/// The on-device store. `main.dart` opens the database and overrides this; tests override it with an
/// in-memory one.
final localStoreProvider = Provider<LocalStore>((ref) {
  throw StateError(
    'localStoreProvider must be overridden with an opened LocalStore',
  );
});

class AppState {
  final Money totalIncome;
  final Money totalExpense;

  /// Latest entries for the dashboard list.
  final List<Map<String, dynamic>> recent;

  const AppState({
    this.totalIncome = Money.zero,
    this.totalExpense = Money.zero,
    this.recent = const [],
  });

  AppState copyWith({
    Money? totalIncome,
    Money? totalExpense,
    List<Map<String, dynamic>>? recent,
  }) {
    return AppState(
      totalIncome: totalIncome ?? this.totalIncome,
      totalExpense: totalExpense ?? this.totalExpense,
      recent: recent ?? this.recent,
    );
  }
}

/// Dashboard state backed by the local database: `Money` totals for this month and the latest
/// entries. Budgets come from the budget repository, roles from `currentRoleProvider`.
class MonthTotalsNotifier extends StateNotifier<AppState> {
  final LocalStore store;
  MonthTotalsNotifier(this.store) : super(const AppState()) {
    reload();
  }

  Future<void> addExpense(
    Money amount, {
    String? note,
    String? categoryId,
    String? accountId,
    String source = 'manual',
  }) async {
    await store.addTransaction(
      type: 'expense',
      amountPaisa: amount.paisa,
      note: note,
      categoryId: categoryId,
      accountId: accountId,
      source: source,
    );
    await reload();
  }

  Future<void> addIncome(
    Money amount, {
    String? note,
    String? categoryId,
    String? accountId,
    String source = 'manual',
  }) async {
    await store.addTransaction(
      type: 'income',
      amountPaisa: amount.paisa,
      note: note,
      categoryId: categoryId,
      accountId: accountId,
      source: source,
    );
    await reload();
  }

  Future<void> reload() async {
    // Months are Asia/Dhaka (UTC+6) calendar months.
    final dhaka = DateTime.now().toUtc().add(const Duration(hours: 6));
    final start = DateTime.utc(
      dhaka.year,
      dhaka.month,
    ).subtract(const Duration(hours: 6));
    final end = DateTime.utc(
      dhaka.year,
      dhaka.month + 1,
    ).subtract(const Duration(hours: 6));
    final totals = await store.totals(start, end);
    final cats = {for (final c in await store.categories()) c.id: c.nameBn};
    final rows = await store.recent(limit: 20);
    if (!mounted) return;
    state = state.copyWith(
      totalIncome: Money(totals.incomePaisa),
      totalExpense: Money(totals.expensePaisa),
      recent: [
        for (final r in rows)
          {
            'type': r.type,
            'category': cats[r.categoryId] ?? r.note ?? 'অন্যান্য',
            'amount': Money(r.amountPaisa),
            'date': r.occurredAt.substring(0, 10),
          },
      ],
    );
  }
}

final appStateProvider = StateNotifierProvider<MonthTotalsNotifier, AppState>((
  ref,
) {
  return MonthTotalsNotifier(ref.watch(localStoreProvider));
});

final recentTransactionsProvider = Provider<List<Map<String, dynamic>>>((ref) {
  return ref.watch(appStateProvider.select((s) => s.recent));
});
