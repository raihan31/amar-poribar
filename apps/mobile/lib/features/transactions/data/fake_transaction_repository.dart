import 'package:drift/drift.dart' show Value;

import '../../../data/database/database.dart';
import '../domain/txn_query.dart';
import 'transaction_repository.dart';

/// In-memory repository for widget tests. Ordering and the private-row rule match the real one.
/// A deleted row moves to [deleted] (a tombstone) and `restore` moves it back.
class FakeTransactionRepository implements TransactionRepository {
  final List<Transaction> rows;
  final List<Transaction> deleted = [];
  var _n = 0;

  FakeTransactionRepository([List<Transaction>? seed]) : rows = [...?seed];

  bool _match(Transaction t, TxnQuery q) {
    if (t.familyId != q.familyId) return false;
    if (t.isPrivate && t.createdBy != q.viewerUserId) return false;
    if (q.categoryId != null && t.categoryId != q.categoryId) return false;
    if (q.paidByUserId != null && t.paidByUserId != q.paidByUserId) {
      return false;
    }
    if (q.accountId != null && t.accountId != q.accountId) return false;
    if (q.type != null && t.type != q.type) return false;
    if (q.source != null && t.source != q.source) return false;
    final r = q.monthRange;
    if (r != null) {
      final at = DateTime.parse(t.occurredAt);
      if (at.isBefore(r.start) || !at.isBefore(r.end)) return false;
    }
    final text = q.text?.toLowerCase();
    if (text != null && text.isNotEmpty) {
      final hay = '${t.note ?? ''}\n${t.counterparty ?? ''}'.toLowerCase();
      if (!hay.contains(text)) return false;
    }
    return true;
  }

  List<Transaction> _sorted(TxnQuery q) =>
      rows.where((t) => _match(t, q)).toList()
        ..sort((a, b) {
          final c = b.occurredAt.compareTo(a.occurredAt);
          return c != 0 ? c : b.id.compareTo(a.id);
        });

  @override
  Future<TxnPage> page(TxnQuery q, {String? cursor, int limit = 50}) async {
    var all = _sorted(q);
    if (cursor != null) {
      final i = all.indexWhere((t) => '${t.occurredAt}|${t.id}' == cursor);
      all = all.sublist(i + 1);
    }
    final items = all.take(limit).toList();
    final more = all.length > limit;
    return TxnPage(
      items,
      more ? '${items.last.occurredAt}|${items.last.id}' : null,
    );
  }

  @override
  Stream<List<Transaction>> watch(TxnQuery q) => Stream.value(_sorted(q));

  @override
  Future<Transaction?> byId(String id) async {
    for (final t in rows) {
      if (t.id == id) return t;
    }
    return null;
  }

  @override
  Future<String> add({
    required String familyId,
    required String type,
    required int amountPaisa,
    int feePaisa = 0,
    DateTime? occurredAt,
    String? categoryId,
    String? accountId,
    String? note,
    String? counterparty,
    String? trxId,
    String source = 'manual',
    bool isPrivate = false,
    String? splitGroupId,
    String? attachmentKey,
    String? paidByUserId,
    String? createdBy,
  }) async {
    final id = 'fake-${++_n}';
    rows.add(
      Transaction(
        id: id,
        type: type,
        amountPaisa: amountPaisa,
        feePaisa: feePaisa,
        occurredAt: (occurredAt ?? DateTime.now()).toUtc().toIso8601String(),
        categoryId: categoryId,
        accountId: accountId,
        note: note,
        counterparty: counterparty,
        trxId: trxId,
        source: source,
        isPrivate: isPrivate,
        hlc: 'fake-$_n',
        familyId: familyId,
        splitGroupId: splitGroupId,
        attachmentKey: attachmentKey,
        paidByUserId: paidByUserId,
        createdBy: createdBy,
        localSeq: _n,
      ),
    );
    return id;
  }

  @override
  Future<void> update(
    String id, {
    String? type,
    int? amountPaisa,
    int? feePaisa,
    DateTime? occurredAt,
    String? categoryId,
    String? accountId,
    String? note,
    bool? isPrivate,
    String? paidByUserId,
  }) async {
    final i = rows.indexWhere((t) => t.id == id);
    if (i < 0) return;
    rows[i] = rows[i].copyWith(
      type: type,
      amountPaisa: amountPaisa,
      feePaisa: feePaisa,
      occurredAt: occurredAt?.toUtc().toIso8601String(),
      categoryId: categoryId == null ? const Value.absent() : Value(categoryId),
      accountId: accountId == null ? const Value.absent() : Value(accountId),
      note: note == null ? const Value.absent() : Value(note),
      isPrivate: isPrivate,
      paidByUserId:
          paidByUserId == null ? const Value.absent() : Value(paidByUserId),
      hlc: 'fake-${++_n}',
    );
  }

  @override
  Future<void> delete(String id) async {
    final i = rows.indexWhere((t) => t.id == id);
    if (i < 0) return;
    deleted.add(rows.removeAt(i));
  }

  @override
  Future<void> restore(String id) async {
    final i = deleted.indexWhere((t) => t.id == id);
    if (i < 0) return;
    rows.add(deleted.removeAt(i));
  }

  @override
  Future<int> purgeOldTombstones() async => 0;
}
