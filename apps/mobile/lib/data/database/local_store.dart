import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import '../sync/hlc.dart';
import 'database.dart';

const _uuid = Uuid();
const _nodeKey = 'node_id';
const _clockKey = 'clock';

/// A transaction as exchanged with peers and the server (JSON field names match the API).
typedef SyncRow = Map<String, dynamic>;

/// Local-first store for transactions (SRS §3.10). Every change is stamped with a hybrid logical clock;
/// merging a change from a peer or the server keeps whichever version has the greater HLC, per record.
class LocalStore {
  final AppDatabase db;
  final String nodeId;
  final DateTime Function() _now;
  Hlc _clock;

  LocalStore._(this.db, this.nodeId, this._clock, this._now);

  /// Opens the store. A device keeps the same node id and clock across restarts.
  static Future<LocalStore> open(AppDatabase db,
      {DateTime Function()? now}) async {
    Future<String?> get(String k) async =>
        (await (db.select(db.meta)..where((m) => m.key.equals(k)))
                .getSingleOrNull())
            ?.value;
    var node = await get(_nodeKey);
    if (node == null) {
      node = 'd${_uuid.v4().substring(0, 8)}';
      await db.into(db.meta).insertOnConflictUpdate(
          MetaCompanion.insert(key: _nodeKey, value: node));
    }
    final saved = await get(_clockKey);
    return LocalStore._(db, node,
        saved == null ? Hlc.zero(node) : Hlc.parse(saved), now ?? DateTime.now);
  }

  Future<Hlc> _tick() async {
    _clock = _clock.send(_now());
    await db.into(db.meta).insertOnConflictUpdate(
        MetaCompanion.insert(key: _clockKey, value: _clock.toString()));
    return _clock;
  }

  // ---- local changes ------------------------------------------------------------------------

  Future<String> addTransaction({
    String? id,
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
  }) async {
    final hlc = await _tick();
    final rowId = id ?? _uuid.v4();
    await db.into(db.transactions).insert(
          TransactionsCompanion.insert(
            id: rowId,
            type: type,
            amountPaisa: amountPaisa,
            feePaisa: Value(feePaisa),
            occurredAt: (occurredAt ?? _now()).toUtc().toIso8601String(),
            categoryId: Value(categoryId),
            accountId: Value(accountId),
            note: Value(note),
            counterparty: Value(counterparty),
            trxId: Value(trxId),
            source: Value(source),
            isPrivate: Value(isPrivate),
            hlc: hlc.toString(),
          ),
        );
    return rowId;
  }

  Future<void> updateTransaction(String id,
      {int? amountPaisa, String? categoryId, String? note}) async {
    final hlc = await _tick();
    await (db.update(db.transactions)..where((t) => t.id.equals(id))).write(
      TransactionsCompanion(
        amountPaisa:
            amountPaisa == null ? const Value.absent() : Value(amountPaisa),
        categoryId:
            categoryId == null ? const Value.absent() : Value(categoryId),
        note: note == null ? const Value.absent() : Value(note),
        hlc: Value(hlc.toString()),
      ),
    );
  }

  /// Soft delete: the row stays as a tombstone so the delete reaches other devices.
  Future<void> deleteTransaction(String id) async {
    final hlc = await _tick();
    await (db.update(db.transactions)..where((t) => t.id.equals(id))).write(
      TransactionsCompanion(
          deletedAt: Value(_now().toUtc().toIso8601String()),
          hlc: Value(hlc.toString())),
    );
  }

  // ---- reads --------------------------------------------------------------------------------

  Future<List<Transaction>> recent({int limit = 20}) =>
      (db.select(db.transactions)
            ..where((t) => t.deletedAt.isNull())
            ..orderBy([(t) => OrderingTerm.desc(t.occurredAt)])
            ..limit(limit))
          .get();

  /// Income and expense totals in paisa for a UTC month range [start, end).
  Future<({int incomePaisa, int expensePaisa})> totals(
      DateTime start, DateTime end) async {
    final rows = await (db.select(db.transactions)
          ..where((t) =>
              t.deletedAt.isNull() &
              t.occurredAt
                  .isBiggerOrEqualValue(start.toUtc().toIso8601String()) &
              t.occurredAt.isSmallerThanValue(end.toUtc().toIso8601String())))
        .get();
    var income = 0;
    var expense = 0;
    for (final r in rows) {
      if (r.type == 'income') income += r.amountPaisa;
      if (r.type == 'expense') expense += r.amountPaisa + r.feePaisa;
    }
    return (incomePaisa: income, expensePaisa: expense);
  }

  // ---- sync ---------------------------------------------------------------------------------

  /// The highest HLC in this store, sent to peers as "what I have".
  Future<String?> latestHlc() async {
    final row = await (db.select(db.transactions)
          ..orderBy([(t) => OrderingTerm.desc(t.hlc)])
          ..limit(1))
        .getSingleOrNull();
    return row?.hlc;
  }

  /// Transactions changed after [since] (exclusive), oldest change first, tombstones included.
  /// Private entries are not shared with other devices unless they created them, so the caller passes
  /// the viewer's own filter via [includePrivate].
  Future<List<SyncRow>> changesSince(String? since,
      {bool includePrivate = false, int limit = 500}) async {
    final q = db.select(db.transactions)
      ..orderBy([(t) => OrderingTerm.asc(t.hlc)])
      ..limit(limit);
    q.where((t) {
      Expression<bool> w = const Constant(true);
      if (since != null) w = w & t.hlc.isBiggerThanValue(since);
      if (!includePrivate) w = w & t.isPrivate.equals(false);
      return w;
    });
    return (await q.get()).map(rowToJson).toList();
  }

  /// Merge changes from a peer or the server. Per record, the greater HLC wins; applying the same
  /// changes twice changes nothing. Returns the number of records that changed locally.
  Future<int> applyChanges(List<SyncRow> changes) async {
    var changed = 0;
    await db.transaction(() async {
      for (final c in changes) {
        final incoming = Hlc.parse(c['hlc'] as String);
        // Rejects a clock too far in the future; also moves our clock past anything we have seen.
        _clock = _clock.receive(incoming, _now());
        final existing = await (db.select(db.transactions)
              ..where((t) => t.id.equals(c['id'] as String)))
            .getSingleOrNull();
        if (existing != null && existing.hlc.compareTo(c['hlc'] as String) >= 0)
          continue;
        await db
            .into(db.transactions)
            .insertOnConflictUpdate(jsonToCompanion(c));
        changed++;
      }
      await db.into(db.meta).insertOnConflictUpdate(
          MetaCompanion.insert(key: _clockKey, value: _clock.toString()));
    });
    return changed;
  }

  // ---- reference data (read-only copy of the API's) ----------------------------------------

  Future<void> replaceCategories(List<Map<String, dynamic>> rows) async {
    await db.transaction(() async {
      await db.delete(db.cachedCategories).go();
      for (final r in rows) {
        await db
            .into(db.cachedCategories)
            .insert(CachedCategoriesCompanion.insert(
              id: r['id'] as String,
              key: r['key'] as String,
              kind: r['kind'] as String,
              nameEn: r['nameEn'] as String,
              nameBn: r['nameBn'] as String,
              icon: Value(r['icon'] as String?),
              isHidden: Value((r['isHidden'] ?? false) as bool),
            ));
      }
    });
  }

  Future<void> replaceAccounts(List<Map<String, dynamic>> rows) async {
    await db.transaction(() async {
      await db.delete(db.cachedAccounts).go();
      for (final r in rows) {
        await db.into(db.cachedAccounts).insert(
              CachedAccountsCompanion.insert(
                  id: r['id'] as String,
                  name: r['name'] as String,
                  type: r['type'] as String),
            );
      }
    });
  }

  Future<List<CachedCategory>> categories() =>
      db.select(db.cachedCategories).get();
  Future<List<CachedAccount>> accounts() => db.select(db.cachedAccounts).get();
}

SyncRow rowToJson(Transaction t) => {
      'id': t.id,
      'type': t.type,
      'amountPaisa': t.amountPaisa,
      'feePaisa': t.feePaisa,
      'occurredAt': t.occurredAt,
      'categoryId': t.categoryId,
      'accountId': t.accountId,
      'note': t.note,
      'counterparty': t.counterparty,
      'trxId': t.trxId,
      'source': t.source,
      'isPrivate': t.isPrivate,
      'deletedAt': t.deletedAt,
      'hlc': t.hlc,
    };

TransactionsCompanion jsonToCompanion(SyncRow j) => TransactionsCompanion(
      id: Value(j['id'] as String),
      type: Value(j['type'] as String),
      amountPaisa: Value((j['amountPaisa'] as num).toInt()),
      feePaisa: Value(((j['feePaisa'] ?? 0) as num).toInt()),
      occurredAt: Value(j['occurredAt'] as String),
      categoryId: Value(j['categoryId'] as String?),
      accountId: Value(j['accountId'] as String?),
      note: Value(j['note'] as String?),
      counterparty: Value(j['counterparty'] as String?),
      trxId: Value(j['trxId'] as String?),
      source: Value((j['source'] ?? 'manual') as String),
      isPrivate: Value((j['isPrivate'] ?? false) as bool),
      deletedAt: Value(j['deletedAt'] as String?),
      hlc: Value(j['hlc'] as String),
    );
