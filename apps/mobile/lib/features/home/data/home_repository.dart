import 'dart:async';

import '../../../core/money/money.dart';
import '../../../data/database/database.dart' show Transaction;
import '../../transactions/data/transaction_repository.dart';
import '../../transactions/domain/txn_query.dart';

/// Income and expense of one month.
class MonthTotals {
  const MonthTotals({this.income = Money.zero, this.expense = Money.zero});

  final Money income;
  final Money expense;

  @override
  bool operator ==(Object other) =>
      other is MonthTotals &&
      other.income == income &&
      other.expense == expense;

  @override
  int get hashCode => Object.hash(income, expense);
}

/// This month against the one before (FR-HOME-01).
class HomeSummary {
  const HomeSummary({required this.current, required this.previous});

  final MonthTotals current;
  final MonthTotals previous;

  /// Positive when this month's spending is higher.
  Money get change => current.expense - previous.expense;

  @override
  bool operator ==(Object other) =>
      other is HomeSummary &&
      other.current == current &&
      other.previous == previous;

  @override
  int get hashCode => Object.hash(current, previous);
}

enum ActivityKind { voice, expense }

/// One row of "latest activity" on Home.
class ActivityItem {
  const ActivityItem({
    required this.kind,
    required this.at,
    this.id,
    this.memberId,
    this.note,
    this.amountPaisa,
    this.voiceSeconds,
  });

  final ActivityKind kind;
  final DateTime at;

  /// Transaction id for an expense row.
  final String? id;
  final String? memberId;
  final String? note;
  final int? amountPaisa;
  final int? voiceSeconds;
}

/// `YYYY-MM` of the month before [month].
String previousMonth(String month) {
  final p = month.split('-');
  final y = int.parse(p[0]);
  final m = int.parse(p[1]);
  return m == 1
      ? '${(y - 1).toString().padLeft(4, '0')}-12'
      : '${p[0]}-${(m - 1).toString().padLeft(2, '0')}';
}

/// What Home reads. Everything comes from the device, so it works offline.
abstract class HomeRepository {
  Stream<HomeSummary> watchSummary({
    required String familyId,
    required String month,
    String? viewerUserId,
  });

  /// The newest [limit] expenses, newest first.
  Stream<List<ActivityItem>> watchLatestExpenses({
    required String familyId,
    String? viewerUserId,
    int limit = 2,
  });
}

/// Reads through the local [TransactionRepository], so a row added by sync shows up at once.
class LocalHomeRepository implements HomeRepository {
  LocalHomeRepository(this._txns);

  final TransactionRepository _txns;

  MonthTotals _sum(Iterable<Transaction> rows) {
    var income = 0;
    var expense = 0;
    for (final t in rows) {
      if (t.type == 'income') income += t.amountPaisa;
      if (t.type == 'expense') {
        expense += t.amountPaisa + t.feePaisa;
      }
    }
    return MonthTotals(income: Money(income), expense: Money(expense));
  }

  @override
  Stream<HomeSummary> watchSummary({
    required String familyId,
    required String month,
    String? viewerUserId,
  }) async* {
    final prevQ = TxnQuery(
      familyId: familyId,
      month: previousMonth(month),
      viewerUserId: viewerUserId,
    );
    final curQ = TxnQuery(
      familyId: familyId,
      month: month,
      viewerUserId: viewerUserId,
    );
    final previous = _sum(await _txns.watch(prevQ).first);
    yield* _txns.watch(curQ).map(
          (rows) => HomeSummary(current: _sum(rows), previous: previous),
        );
  }

  @override
  Stream<List<ActivityItem>> watchLatestExpenses({
    required String familyId,
    String? viewerUserId,
    int limit = 2,
  }) =>
      _txns
          .watch(
            TxnQuery(
              familyId: familyId,
              type: 'expense',
              viewerUserId: viewerUserId,
            ),
          )
          .map(
            (rows) => [
              for (final t in rows.take(limit))
                ActivityItem(
                  kind: ActivityKind.expense,
                  at: DateTime.parse(t.occurredAt),
                  id: t.id,
                  memberId: t.paidByUserId ?? t.createdBy,
                  note: t.note ?? t.counterparty,
                  amountPaisa: t.amountPaisa + t.feePaisa,
                ),
            ],
          );
}

/// In-memory home data for widget tests.
class FakeHomeRepository implements HomeRepository {
  FakeHomeRepository({
    this.summary = const HomeSummary(
      current: MonthTotals(expense: Money(4250000)),
      previous: MonthTotals(expense: Money(3930000)),
    ),
    this.expenses = const [],
  });

  HomeSummary summary;
  List<ActivityItem> expenses;
  final _changes = StreamController<HomeSummary>.broadcast(sync: true);

  /// Pretends a sync wrote new rows: every listener sees [next] at once.
  void emit(HomeSummary next) {
    summary = next;
    _changes.add(next);
  }

  @override
  Stream<HomeSummary> watchSummary({
    required String familyId,
    required String month,
    String? viewerUserId,
  }) async* {
    yield summary;
    yield* _changes.stream;
  }

  @override
  Stream<List<ActivityItem>> watchLatestExpenses({
    required String familyId,
    String? viewerUserId,
    int limit = 2,
  }) =>
      Stream.value(expenses.take(limit).toList());
}
