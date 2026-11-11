import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import '../../features/transactions/domain/txn_query.dart';
import '../sync/hlc.dart';
import 'database.dart';
import 'tables.dart' show Transactions;

const _uuid = Uuid();
const _nodeKey = 'node_id';
const _clockKey = 'clock';
const _seqKey = 'seq';

/// A transaction as exchanged with peers and the server (JSON field names match the API).
typedef SyncRow = Map<String, dynamic>;

/// A page of the transaction list; [nextCursor] is null on the last page.
class TxnPage {
  final List<Transaction> items;
  final String? nextCursor;
  const TxnPage(this.items, this.nextCursor);
}

/// Thrown when a deleted entry is 30 days old or more and can no longer be restored.
class RestoreWindowClosed implements Exception {
  const RestoreWindowClosed();
  @override
  String toString() => 'RestoreWindowClosed';
}

const tombstoneWindow = Duration(days: 30);

/// A page of local changes. [lastSeq] is the position to continue from.
class ChangeBatch {
  final List<SyncRow> rows;
  final int lastSeq;
  final bool more;
  ChangeBatch(this.rows, this.lastSeq, this.more);
}

/// Local-first store for transactions (SRS §3.10). Every change is stamped with a hybrid logical clock;
/// merging a change from a peer or the server keeps whichever version has the greater HLC, per record.
class LocalStore {
  final AppDatabase db;
  final String nodeId;
  final DateTime Function() _now;
  Hlc _clock;

  LocalStore._(this.db, this.nodeId, this._clock, this._now);

  /// Opens the store. A device keeps the same node id and clock across restarts.
  static Future<LocalStore> open(
    AppDatabase db, {
    DateTime Function()? now,
  }) async {
    Future<String?> get(String k) async =>
        (await (db.select(db.meta)..where((m) => m.key.equals(k)))
                .getSingleOrNull())
            ?.value;
    var node = await get(_nodeKey);
    if (node == null) {
      node = 'd${_uuid.v4().substring(0, 8)}';
      await db.into(db.meta).insertOnConflictUpdate(
            MetaCompanion.insert(key: _nodeKey, value: node),
          );
    }
    final saved = await get(_clockKey);
    return LocalStore._(
      db,
      node,
      saved == null ? Hlc.zero(node) : Hlc.parse(saved),
      now ?? DateTime.now,
    );
  }

  Future<Hlc> _tick() async {
    _clock = _clock.send(_now());
    await db.into(db.meta).insertOnConflictUpdate(
          MetaCompanion.insert(key: _clockKey, value: _clock.toString()),
        );
    return _clock;
  }

  // ---- change log ---------------------------------------------------------------------------

  Future<String?> getMeta(String key) async =>
      (await (db.select(db.meta)..where((m) => m.key.equals(key)))
              .getSingleOrNull())
          ?.value;

  Future<void> setMeta(String key, String value) => db
      .into(db.meta)
      .insertOnConflictUpdate(MetaCompanion.insert(key: key, value: value));

  /// Deletes every local row (transactions, caches, queued entries, meta) but keeps this
  /// device's node id. Used when a different person signs in on this phone (T-MOB-16).
  Future<void> wipeLocalData() async {
    await db.transaction(() async {
      for (final table in db.allTables) {
        if (table == db.meta) {
          await (db.delete(db.meta)..where((m) => m.key.equals(_nodeKey).not()))
              .go();
        } else {
          await db.delete(table).go();
        }
      }
    });
    _clock = Hlc.zero(nodeId);
  }

  /// Highest sequence number handed out so far.
  Future<int> currentSeq() async => int.parse(await getMeta(_seqKey) ?? '0');

  Future<int> _nextSeq() async {
    final next = await currentSeq() + 1;
    await setMeta(_seqKey, '$next');
    return next;
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
    String? familyId,
    String? splitGroupId,
    String? attachmentKey,
    String? paidByUserId,
    String? createdBy,
  }) async {
    final hlc = await _tick();
    final family = familyId ?? await getMeta('active_family') ?? '';
    final seq = await _nextSeq();
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
            familyId: Value(family),
            splitGroupId: Value(splitGroupId),
            attachmentKey: Value(attachmentKey),
            paidByUserId: Value(paidByUserId),
            createdBy: Value(createdBy),
            hlc: hlc.toString(),
            localSeq: Value(seq),
          ),
        );
    return rowId;
  }

  Future<void> updateTransaction(
    String id, {
    int? amountPaisa,
    String? categoryId,
    String? note,
  }) async {
    final hlc = await _tick();
    final seq = await _nextSeq();
    await (db.update(db.transactions)..where((t) => t.id.equals(id))).write(
      TransactionsCompanion(
        localSeq: Value(seq),
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
    final seq = await _nextSeq();
    await (db.update(db.transactions)..where((t) => t.id.equals(id))).write(
      TransactionsCompanion(
        deletedAt: Value(_now().toUtc().toIso8601String()),
        hlc: Value(hlc.toString()),
        localSeq: Value(seq),
      ),
    );
  }

  /// Undo a delete: clears the tombstone with a new HLC and sequence number. Only possible for
  /// [tombstoneWindow] after the delete; otherwise throws [RestoreWindowClosed].
  Future<void> restoreTransaction(String id) async {
    final row = await (db.select(db.transactions)
          ..where((t) => t.id.equals(id)))
        .getSingleOrNull();
    if (row == null || row.deletedAt == null) return;
    final age = _now().difference(DateTime.parse(row.deletedAt!));
    if (age >= tombstoneWindow) throw const RestoreWindowClosed();
    final hlc = await _tick();
    final seq = await _nextSeq();
    await (db.update(db.transactions)..where((t) => t.id.equals(id))).write(
      TransactionsCompanion(
        deletedAt: const Value(null),
        hlc: Value(hlc.toString()),
        localSeq: Value(seq),
      ),
    );
  }

  /// Removes tombstones deleted more than 30 days ago that the server already has (pushed).
  /// A tombstone not yet pushed is never removed. Returns how many rows went.
  Future<int> purgeOldTombstones() async {
    final pushed = int.parse(await getMeta('server_pushed_seq') ?? '0');
    final cutoff = _now().subtract(tombstoneWindow).toUtc().toIso8601String();
    return (db.delete(db.transactions)
          ..where(
            (t) =>
                t.deletedAt.isNotNull() &
                t.deletedAt.isSmallerThanValue(cutoff) &
                t.localSeq.isSmallerOrEqualValue(pushed),
          ))
        .go();
  }

  // ---- reads --------------------------------------------------------------------------------

  Future<List<Transaction>> recent({int limit = 20}) =>
      (db.select(db.transactions)
            ..where((t) => t.deletedAt.isNull())
            ..orderBy([(t) => OrderingTerm.desc(t.occurredAt)])
            ..limit(limit))
          .get();

  Future<Transaction?> byId(String id) => (db.select(db.transactions)
        ..where((t) => t.id.equals(id) & t.deletedAt.isNull()))
      .getSingleOrNull();

  Expression<bool> _filter(Transactions t, TxnQuery q) {
    Expression<bool> w = t.deletedAt.isNull() & t.familyId.equals(q.familyId);
    final r = q.monthRange;
    if (r != null) {
      w = w &
          t.occurredAt.isBiggerOrEqualValue(r.start.toIso8601String()) &
          t.occurredAt.isSmallerThanValue(r.end.toIso8601String());
    }
    if (q.categoryId != null) w = w & t.categoryId.equals(q.categoryId!);
    if (q.paidByUserId != null) w = w & t.paidByUserId.equals(q.paidByUserId!);
    if (q.accountId != null) w = w & t.accountId.equals(q.accountId!);
    if (q.type != null) w = w & t.type.equals(q.type!);
    if (q.source != null) w = w & t.source.equals(q.source!);
    final text = q.text?.trim();
    if (text != null && text.isNotEmpty) {
      final like = '%$text%';
      w = w & (t.note.like(like) | t.counterparty.like(like));
    }
    final me = q.viewerUserId;
    w = w &
        (me == null
            ? t.isPrivate.equals(false)
            : t.isPrivate.equals(false) | t.createdBy.equals(me));
    return w;
  }

  /// One page of the list, newest first (`occurredAt DESC, id DESC`). The cursor is base64 of `occurredAt|id`.
  Future<TxnPage> page(TxnQuery q, {String? cursor, int limit = 50}) async {
    final sel = db.select(db.transactions)
      ..orderBy([
        (t) => OrderingTerm.desc(t.occurredAt),
        (t) => OrderingTerm.desc(t.id),
      ])
      ..limit(limit + 1);
    sel.where((t) {
      var w = _filter(t, q);
      if (cursor != null) {
        final raw = utf8.decode(base64Url.decode(cursor));
        final i = raw.lastIndexOf('|');
        final at = raw.substring(0, i);
        final id = raw.substring(i + 1);
        w = w &
            (t.occurredAt.isSmallerThanValue(at) |
                (t.occurredAt.equals(at) & t.id.isSmallerThanValue(id)));
      }
      return w;
    });
    final rows = await sel.get();
    final more = rows.length > limit;
    final items = more ? rows.sublist(0, limit) : rows;
    final next = more
        ? base64Url
            .encode(utf8.encode('${items.last.occurredAt}|${items.last.id}'))
        : null;
    return TxnPage(items, next);
  }

  Stream<List<Transaction>> watch(TxnQuery q) => (db.select(db.transactions)
        ..where((t) => _filter(t, q))
        ..orderBy([
          (t) => OrderingTerm.desc(t.occurredAt),
          (t) => OrderingTerm.desc(t.id),
        ]))
      .watch();

  /// Income and expense totals in paisa for a UTC month range [start, end).
  Future<({int incomePaisa, int expensePaisa})> totals(
    DateTime start,
    DateTime end,
  ) async {
    final rows = await (db.select(db.transactions)
          ..where(
            (t) =>
                t.deletedAt.isNull() &
                t.occurredAt
                    .isBiggerOrEqualValue(start.toUtc().toIso8601String()) &
                t.occurredAt.isSmallerThanValue(end.toUtc().toIso8601String()),
          ))
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

  /// Changes made after [seq] in this device's change log, oldest first, tombstones included.
  /// Private entries are only passed on when [includePrivate] is set (for the server, which keeps them
  /// visible to their creator only); peers never get them.
  Future<ChangeBatch> changesAfter(
    int seq, {
    bool includePrivate = false,
    int limit = 500,
  }) async {
    final q = db.select(db.transactions)
      ..orderBy([(t) => OrderingTerm.asc(t.localSeq)])
      ..limit(limit + 1);
    q.where((t) {
      Expression<bool> w = t.localSeq.isBiggerThanValue(seq);
      if (!includePrivate) w = w & t.isPrivate.equals(false);
      return w;
    });
    final rows = await q.get();
    final more = rows.length > limit;
    final page = more ? rows.sublist(0, limit) : rows;
    return ChangeBatch(
      page.map(rowToJson).toList(),
      page.isEmpty ? seq : page.last.localSeq,
      more,
    );
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
        if (existing != null &&
            existing.hlc.compareTo(c['hlc'] as String) >= 0) {
          continue;
        }
        // Merged rows get a place in our own change log so peers and the server can fetch them from us.
        final seq = await _nextSeq();
        await db
            .into(db.transactions)
            .insertOnConflictUpdate(jsonToCompanion(c, seq));
        changed++;
      }
      await db.into(db.meta).insertOnConflictUpdate(
            MetaCompanion.insert(key: _clockKey, value: _clock.toString()),
          );
    });
    return changed;
  }

  // ---- offline AI queue (FR-SYNC-03) -------------------------------------------------------

  Future<String> queueText(String text, {String source = 'ai_text'}) async {
    final id = _uuid.v4();
    final order = int.parse(await getMeta('pending_order') ?? '0') + 1;
    await setMeta('pending_order', '$order');
    await db.into(db.pendingEntries).insert(
          PendingEntriesCompanion.insert(
            id: id,
            rawText: text,
            queueOrder: order,
            source: Value(source),
            createdAt: _now().toUtc().toIso8601String(),
          ),
        );
    return id;
  }

  /// All waiting items in capture order (and, within one text, the order its entries were proposed in).
  Future<List<PendingEntry>> pending() => (db.select(db.pendingEntries)
        ..orderBy([
          (p) => OrderingTerm.asc(p.queueOrder),
          (p) => OrderingTerm.asc(p.subOrder),
        ]))
      .get();

  /// Replace a queued text by one ready row per proposed entry (or none, if nothing was understood).
  Future<void> markParsed(String id, List<Map<String, dynamic>> drafts) =>
      db.transaction(() async {
        final row = await (db.select(db.pendingEntries)
              ..where((p) => p.id.equals(id)))
            .getSingleOrNull();
        if (row == null) return;
        await (db.delete(db.pendingEntries)..where((p) => p.id.equals(id)))
            .go();
        for (var i = 0; i < drafts.length; i++) {
          await db.into(db.pendingEntries).insert(
                PendingEntriesCompanion.insert(
                  id: _uuid.v4(),
                  rawText: row.rawText,
                  queueOrder: row.queueOrder,
                  subOrder: Value(i),
                  source: Value(row.source),
                  createdAt: row.createdAt,
                  status: const Value('ready'),
                  draftJson: Value(jsonEncode(drafts[i])),
                ),
              );
        }
      });

  Future<void> markFailed(String id, String error) =>
      (db.update(db.pendingEntries)..where((p) => p.id.equals(id))).write(
        PendingEntriesCompanion(
          status: const Value('failed'),
          error: Value(error),
        ),
      );

  Future<void> deletePending(String id) =>
      (db.delete(db.pendingEntries)..where((p) => p.id.equals(id))).go();

  // ---- reference data (read-only copy of the API's) ----------------------------------------

  Future<void> replaceCategories(List<Map<String, dynamic>> rows) async {
    await db.transaction(() async {
      await db.delete(db.cachedCategories).go();
      for (final r in rows) {
        await db.into(db.cachedCategories).insert(
              CachedCategoriesCompanion.insert(
                id: r['id'] as String,
                key: r['key'] as String,
                kind: r['kind'] as String,
                nameEn: r['nameEn'] as String,
                nameBn: r['nameBn'] as String,
                icon: Value(r['icon'] as String?),
                isHidden: Value((r['isHidden'] ?? false) as bool),
              ),
            );
      }
    });
  }

  /// Replaces the cached accounts. The archived flag is kept for an account the server does not say
  /// anything about (`archived` / `archivedAt` absent); when it does, the server wins.
  Future<void> replaceAccounts(List<Map<String, dynamic>> rows) async {
    await db.transaction(() async {
      final wasArchived = {
        for (final a in await db.select(db.cachedAccounts).get())
          a.id: a.archived,
      };
      await db.delete(db.cachedAccounts).go();
      for (final r in rows) {
        final id = r['id'] as String;
        final bool archived = r.containsKey('archived')
            ? r['archived'] as bool
            : r.containsKey('archivedAt')
                ? r['archivedAt'] != null
                : wasArchived[id] ?? false;
        await db.into(db.cachedAccounts).insert(
              CachedAccountsCompanion.insert(
                id: id,
                name: r['name'] as String,
                type: r['type'] as String,
                balancePaisa: Value(((r['balancePaisa'] ?? 0) as num).toInt()),
                ownerUserId: Value(r['ownerUserId'] as String?),
                archived: Value(archived),
                openingBalancePaisa:
                    Value(((r['openingBalancePaisa'] ?? 0) as num).toInt()),
              ),
            );
      }
    });
  }

  Stream<List<CachedAccount>> watchAccounts() =>
      db.select(db.cachedAccounts).watch();

  /// Replaces all cached budgets of [familyId] in one transaction (a bad row leaves the old ones).
  Future<void> replaceBudgets(
    String familyId,
    List<Map<String, dynamic>> rows,
  ) async {
    await db.transaction(() async {
      await (db.delete(db.cachedBudgets)
            ..where((b) => b.familyId.equals(familyId)))
          .go();
      for (final r in rows) {
        await db.into(db.cachedBudgets).insert(
              CachedBudgetsCompanion.insert(
                id: r['id'] as String,
                familyId: familyId,
                categoryId: Value(r['categoryId'] as String?),
                month: r['month'] as String,
                limitPaisa: (r['limitPaisa'] as num).toInt(),
                spentPaisa: Value(((r['spentPaisa'] ?? 0) as num).toInt()),
                level: Value((r['level'] ?? 'ok') as String),
              ),
            );
      }
    });
  }

  Stream<List<CachedBudget>> watchBudgets(String familyId, String month) =>
      (db.select(db.cachedBudgets)
            ..where((b) => b.familyId.equals(familyId) & b.month.equals(month)))
          .watch();

  Future<void> replaceMembers(
    String familyId,
    List<Map<String, dynamic>> rows,
  ) async {
    await db.transaction(() async {
      await (db.delete(db.cachedMembers)
            ..where((m) => m.familyId.equals(familyId)))
          .go();
      for (final r in rows) {
        await db.into(db.cachedMembers).insert(
              CachedMembersCompanion.insert(
                userId: r['userId'] as String,
                familyId: familyId,
                name: (r['name'] ?? '') as String,
                role: r['role'] as String,
                phoneLast3: Value((r['phoneLast3'] ?? '') as String),
                avatarIndex: Value(((r['avatarIndex'] ?? 0) as num).toInt()),
              ),
            );
      }
    });
  }

  Stream<List<CachedMember>> watchMembers(String familyId) =>
      (db.select(db.cachedMembers)..where((m) => m.familyId.equals(familyId)))
          .watch();

  Future<void> replaceEntitlements(String familyId, Map<String, dynamic> e) =>
      db.into(db.cachedEntitlements).insertOnConflictUpdate(
            CachedEntitlementsCompanion.insert(
              familyId: familyId,
              planCode: e['planCode'] as String,
              memberLimit: (e['memberLimit'] as num).toInt(),
              aiQuotaMonth: (e['aiQuotaMonth'] as num).toInt(),
              aiUsedMonth: Value(((e['aiUsedMonth'] ?? 0) as num).toInt()),
              historyMonths: Value((e['historyMonths'] as num?)?.toInt()),
              flagsJson: Value(jsonEncode(e['flags'] ?? const {})),
            ),
          );

  Future<CachedEntitlement?> entitlements(String familyId) =>
      (db.select(db.cachedEntitlements)
            ..where((e) => e.familyId.equals(familyId)))
          .getSingleOrNull();

  Future<String?> categoryIdForKey(String? key) async {
    if (key == null) return null;
    return (await (db.select(db.cachedCategories)
              ..where((c) => c.key.equals(key)))
            .getSingleOrNull())
        ?.id;
  }

  /// First cached account of the given type (cash, bkash, ...), if any.
  Future<String?> accountIdForType(String? type) async {
    if (type == null) return null;
    final rows = await (db.select(db.cachedAccounts)
          ..where((a) => a.type.equals(type)))
        .get();
    return rows.isEmpty ? null : rows.first.id;
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
      'splitGroupId': t.splitGroupId,
      'attachmentKey': t.attachmentKey,
      'paidByUserId': t.paidByUserId,
      'createdBy': t.createdBy,
    };

TransactionsCompanion jsonToCompanion(SyncRow j, int seq) =>
    TransactionsCompanion(
      localSeq: Value(seq),
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
      splitGroupId: Value(j['splitGroupId'] as String?),
      attachmentKey: Value(j['attachmentKey'] as String?),
      paidByUserId: Value(j['paidByUserId'] as String?),
      createdBy: Value(j['createdBy'] as String?),
    );
