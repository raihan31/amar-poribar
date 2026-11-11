import 'package:drift/drift.dart';

/// Money entries. Synced between devices and the server by HLC (SRS FR-SYNC-02, §4.3.1).
/// Amounts are integer paisa. A delete is a tombstone: [deletedAt] set with a newer [hlc].
@TableIndex.sql(
  'CREATE INDEX txn_family_time ON transactions (family_id, occurred_at DESC, id DESC)',
)
class Transactions extends Table {
  TextColumn get id => text()();
  TextColumn get type => text()(); // expense | income | transfer
  IntColumn get amountPaisa => integer()();
  IntColumn get feePaisa => integer().withDefault(const Constant(0))();
  TextColumn get occurredAt => text()(); // ISO-8601 with offset
  TextColumn get categoryId => text().nullable()();
  TextColumn get accountId => text().nullable()();
  TextColumn get note => text().nullable()();
  TextColumn get counterparty => text().nullable()();
  TextColumn get trxId => text().nullable()();
  TextColumn get source => text().withDefault(const Constant('manual'))();
  BoolColumn get isPrivate => boolean().withDefault(const Constant(false))();
  TextColumn get deletedAt => text().nullable()();
  TextColumn get hlc => text()();

  /// Family the row belongs to ('' until a family is known; migrated to the active family).
  TextColumn get familyId => text().withDefault(const Constant(''))();
  TextColumn get splitGroupId => text().nullable()();
  TextColumn get attachmentKey => text().nullable()();
  TextColumn get paidByUserId => text().nullable()();
  TextColumn get createdBy => text().nullable()();

  /// Position in this device's own change log, bumped on every local write and every merge. Sync
  /// cursors (per peer, and for the server) page by this, not by HLC, because HLCs are assigned by
  /// different devices and an entry made offline can carry an HLC older than what a peer already holds.
  IntColumn get localSeq => integer().withDefault(const Constant(0))();

  @override
  Set<Column> get primaryKey => {id};
}

/// Read-only copy of the family's categories, pulled from the API (admins manage them over REST).
class CachedCategories extends Table {
  TextColumn get id => text()();
  TextColumn get key => text()();
  TextColumn get kind => text()();
  TextColumn get nameEn => text()();
  TextColumn get nameBn => text()();
  TextColumn get icon => text().nullable()();
  BoolColumn get isHidden => boolean().withDefault(const Constant(false))();

  @override
  Set<Column> get primaryKey => {id};
}

/// Read-only copy of the family's accounts, pulled from the API.
class CachedAccounts extends Table {
  TextColumn get id => text()();
  TextColumn get name => text()();
  TextColumn get type => text()();
  IntColumn get balancePaisa => integer().withDefault(const Constant(0))();
  TextColumn get ownerUserId => text().nullable()();
  BoolColumn get archived => boolean().withDefault(const Constant(false))();
  IntColumn get openingBalancePaisa =>
      integer().withDefault(const Constant(0))();

  @override
  Set<Column> get primaryKey => {id};
}

/// Read-only copy of GET /budgets for one family and month (FR-SYNC-08). A null [categoryId] is the overall budget.
class CachedBudgets extends Table {
  TextColumn get id => text()();
  TextColumn get familyId => text()();
  TextColumn get categoryId => text().nullable()();
  TextColumn get month => text()(); // YYYY-MM
  IntColumn get limitPaisa => integer()();
  IntColumn get spentPaisa => integer().withDefault(const Constant(0))();
  TextColumn get level =>
      text().withDefault(const Constant('ok'))(); // ok | warning | exceeded

  @override
  Set<Column> get primaryKey => {id};
}

class CachedMembers extends Table {
  TextColumn get userId => text()();
  TextColumn get familyId => text()();
  TextColumn get name => text()();
  TextColumn get role => text()();
  TextColumn get phoneLast3 => text().withDefault(const Constant(''))();
  IntColumn get avatarIndex => integer().withDefault(const Constant(0))();

  @override
  Set<Column> get primaryKey => {userId, familyId};
}

/// Plan limits and feature flags, one row per family.
class CachedEntitlements extends Table {
  TextColumn get familyId => text()();
  TextColumn get planCode => text()();
  IntColumn get memberLimit => integer()();
  IntColumn get aiQuotaMonth => integer()();
  IntColumn get aiUsedMonth => integer().withDefault(const Constant(0))();
  IntColumn get historyMonths => integer().nullable()();
  TextColumn get flagsJson => text().withDefault(const Constant('{}'))();

  @override
  Set<Column> get primaryKey => {familyId};
}

/// Small key/value table for local state such as this device's node id and sync high-water marks.
class Meta extends Table {
  TextColumn get key => text()();
  TextColumn get value => text()();

  @override
  Set<Column> get primaryKey => {key};
}

/// Text typed or spoken while offline, waiting to be understood by the AI once the phone is online (FR-SYNC-03).
/// A `queued` row holds the raw text; after parsing it becomes one `ready` row per proposed entry, which the
/// user still has to confirm (FR-AI-05).
class PendingEntries extends Table {
  TextColumn get id => text()();
  TextColumn get rawText => text()();

  /// Order the texts were captured in (a counter, so two entries in the same millisecond keep their order),
  /// then the position of a proposed entry within one text.
  IntColumn get queueOrder => integer()();
  IntColumn get subOrder => integer().withDefault(const Constant(0))();
  TextColumn get source =>
      text().withDefault(const Constant('ai_text'))(); // ai_text | voice
  TextColumn get createdAt => text()();
  TextColumn get status =>
      text().withDefault(const Constant('queued'))(); // queued | ready | failed
  TextColumn get draftJson => text().nullable()();
  TextColumn get error => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}
