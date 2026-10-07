import 'package:drift/drift.dart';

// Drift Table for Transactions
class TransactionsTable extends Table {
  TextColumn get id => text()();
  TextColumn get deviceId => text()();
  RealColumn get amount => real()();
  TextColumn get categoryId => text()();
  TextColumn get type => text()(); // 'income' or 'expense'
  TextColumn get note => text().withLength(max: 500)();
  TextColumn get timestamp => text()();
  TextColumn get bankMessageId => text().nullable()();
  
  // CRDT base columns (sqlite_crdt manages these via triggers, but Drift needs to know they exist if we query them directly, usually injected)
  IntColumn get isDeleted => integer().withDefault(const Constant(0))();
  TextColumn get hlc => text()();
  TextColumn get modified => text()();

  @override
  Set<Column> get primaryKey => {id};
}

// Drift Table for Categories
class CategoriesTable extends Table {
  TextColumn get id => text()();
  TextColumn get name => text()();
  TextColumn get icon => text()();
  TextColumn get colorHex => text()();
  TextColumn get type => text()();

  IntColumn get isDeleted => integer().withDefault(const Constant(0))();
  TextColumn get hlc => text()();
  TextColumn get modified => text()();

  @override
  Set<Column> get primaryKey => {id};
}

// Drift Table for UserDevices
class UserDevicesTable extends Table {
  TextColumn get id => text()();
  TextColumn get role => text()(); // 'father', 'mother', 'child'
  TextColumn get name => text()();
  TextColumn get publicKey => text()();
  TextColumn get masterKeyHash => text()();

  IntColumn get isDeleted => integer().withDefault(const Constant(0))();
  TextColumn get hlc => text()();
  TextColumn get modified => text()();

  @override
  Set<Column> get primaryKey => {id};
}

// Drift Table for Budgets
class BudgetsTable extends Table {
  TextColumn get id => text()();
  TextColumn get roleOwnerId => text()();
  TextColumn get categoryId => text().nullable()();
  RealColumn get amount => real()();
  TextColumn get periodStart => text()();
  TextColumn get periodEnd => text()();

  IntColumn get isDeleted => integer().withDefault(const Constant(0))();
  TextColumn get hlc => text()();
  TextColumn get modified => text()();

  @override
  Set<Column> get primaryKey => {id};
}

// Drift Table for BankMessages
class BankMessagesTable extends Table {
  TextColumn get id => text()();
  TextColumn get rawText => text()();
  TextColumn get sender => text()();
  TextColumn get status => text()(); // pending, approved, rejected
  RealColumn get detectedAmount => real().nullable()();
  TextColumn get detectedType => text().nullable()();
  TextColumn get receivedAt => text()();

  IntColumn get isDeleted => integer().withDefault(const Constant(0))();
  TextColumn get hlc => text()();
  TextColumn get modified => text()();

  @override
  Set<Column> get primaryKey => {id};
}
