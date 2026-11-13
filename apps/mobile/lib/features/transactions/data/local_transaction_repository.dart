import '../../../data/database/database.dart';
import '../../../data/database/local_store.dart';
import '../domain/txn_query.dart';
import 'transaction_repository.dart';

/// Everything local: reads and writes go through [LocalStore], so the HLC and `localSeq` code path
/// is the one sync already uses.
class LocalTransactionRepository implements TransactionRepository {
  final LocalStore store;
  final DateTime Function() _now;

  LocalTransactionRepository(this.store, {DateTime Function()? now})
      : _now = now ?? DateTime.now;

  @override
  Future<TxnPage> page(TxnQuery q, {String? cursor, int limit = 50}) =>
      store.page(q, cursor: cursor, limit: limit);

  @override
  Stream<List<Transaction>> watch(TxnQuery q) => store.watch(q);

  @override
  Future<Transaction?> byId(String id) => store.byId(id);

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
    String source = 'manual',
    bool isPrivate = false,
    String? splitGroupId,
    String? attachmentKey,
    String? paidByUserId,
    String? createdBy,
  }) =>
      store.addTransaction(
        familyId: familyId,
        type: type,
        amountPaisa: amountPaisa,
        feePaisa: feePaisa,
        occurredAt: occurredAt ?? _now(),
        categoryId: categoryId,
        accountId: accountId,
        note: note,
        counterparty: counterparty,
        source: source,
        isPrivate: isPrivate,
        splitGroupId: splitGroupId,
        attachmentKey: attachmentKey,
        paidByUserId: paidByUserId,
        createdBy: createdBy,
      );

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
  }) =>
      store.updateTransaction(
        id,
        type: type,
        amountPaisa: amountPaisa,
        feePaisa: feePaisa,
        occurredAt: occurredAt,
        categoryId: categoryId,
        accountId: accountId,
        note: note,
        isPrivate: isPrivate,
        paidByUserId: paidByUserId,
      );

  @override
  Future<void> delete(String id) => store.deleteTransaction(id);

  @override
  Future<void> restore(String id) => store.restoreTransaction(id);

  @override
  Future<int> purgeOldTombstones() => store.purgeOldTombstones();
}
