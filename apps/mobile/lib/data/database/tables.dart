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
