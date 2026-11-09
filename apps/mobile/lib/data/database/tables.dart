import 'package:drift/drift.dart';

/// Money entries. Synced between devices and the server by HLC (SRS FR-SYNC-02, §4.3.1).
/// Amounts are integer paisa. A delete is a tombstone: [deletedAt] set with a newer [hlc].
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

  @override
  Set<Column> get primaryKey => {id};
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
