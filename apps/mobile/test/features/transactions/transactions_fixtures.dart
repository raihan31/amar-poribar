import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/domain/models/api/me.dart';
import 'package:amar_poribar/domain/models/role.dart';
import 'package:amar_poribar/features/family/data/fake_family_repository.dart';
import 'package:amar_poribar/features/family/state/active_family.dart';
import 'package:amar_poribar/features/home/state/home_providers.dart';
import 'package:amar_poribar/features/transactions/data/fake_transaction_repository.dart';
import 'package:amar_poribar/features/transactions/data/transaction_repository.dart';
import 'package:amar_poribar/features/transactions/domain/txn_query.dart';
import 'package:amar_poribar/features/transactions/state/transactions_controller.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'add_expense_fixtures.dart';

/// 12:00 UTC on 9 Nov 2026 is 18:00 in Dhaka, same day.
final DateTime kListNow = DateTime.utc(2026, 11, 9, 12);

Transaction row(
  String id, {
  required DateTime at,
  String type = 'expense',
  int amount = 85000,
  String? category = 'c-bazaar',
  String? account = 'a-cash',
  String? paidBy = 'u-ammu',
  String source = 'manual',
  bool isPrivate = false,
  String? note,
}) =>
    Transaction(
      id: id,
      type: type,
      amountPaisa: amount,
      feePaisa: 0,
      occurredAt: at.toUtc().toIso8601String(),
      categoryId: category,
      accountId: account,
      note: note,
      counterparty: null,
      source: source,
      isPrivate: isPrivate,
      hlc: 'h-$id',
      familyId: FakeFamilyRepository.familyId,
      paidByUserId: paidBy,
      createdBy: paidBy,
      localSeq: 1,
    );

/// The rows of the Txns.dc.html board, plus one from October.
List<Transaction> boardRows() => [
      row('t1', at: DateTime.utc(2026, 11, 9, 10), source: 'voice'),
      row(
        't2',
        at: DateTime.utc(2026, 11, 9, 9),
        amount: 200000,
        account: 'a-bkash',
        paidBy: FakeFamilyRepository.meId,
        source: 'sms',
      ),
      row(
        't3',
        at: DateTime.utc(2026, 11, 8, 9),
        amount: 234000,
        category: 'c-bill',
        account: 'a-bkash',
        paidBy: FakeFamilyRepository.meId,
      ),
      row(
        't4',
        at: DateTime.utc(2026, 11, 8, 8),
        type: 'income',
        amount: 6500000,
        category: 'c-salary',
        paidBy: FakeFamilyRepository.meId,
      ),
      row(
        't5',
        at: DateTime.utc(2026, 11, 8, 7),
        amount: 30000,
        paidBy: FakeFamilyRepository.meId,
        isPrivate: true,
      ),
      row('oct', at: DateTime.utc(2026, 10, 20, 7), amount: 11100),
    ];

/// Remembers every query the list sends.
class RecordingTransactionRepository extends FakeTransactionRepository {
  RecordingTransactionRepository([super.seed]);

  final queries = <TxnQuery>[];
  final cursors = <String?>[];

  @override
  Future<TxnPage> page(TxnQuery q, {String? cursor, int limit = 50}) {
    queries.add(q);
    cursors.add(cursor);
    return super.page(q, cursor: cursor, limit: limit);
  }
}

class CsvShare {
  const CsvShare(this.fileName, this.csv);
  final String fileName;
  final String csv;
}

List<Override> listOverrides(
  FakeTransactionRepository repo, {
  FamilyRole role = FamilyRole.owner,
  List<CsvShare>? shared,
}) =>
    [
      ...addExpenseOverrides(repo, role: role),
      activeFamilyProvider.overrideWithValue(
        const FamilyInfo(
          FakeFamilyRepository.familyId,
          'রহিম পরিবার',
          'owner',
        ),
      ),
      homeClockProvider.overrideWithValue(() => kListNow),
      homeRefreshProvider.overrideWithValue(() async {}),
      csvSharerProvider.overrideWithValue((name, csv) async {
        shared?.add(CsvShare(name, csv));
      }),
    ];
