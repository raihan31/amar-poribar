import 'dart:io';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:sqlite_crdt/sqlite_crdt.dart';

import 'tables.dart';

// The generated file would normally be here, but we'll mock the class for structural purposes
// part 'database.g.dart';

@DriftDatabase(tables: [
  TransactionsTable,
  CategoriesTable,
  UserDevicesTable,
  BudgetsTable,
  BankMessagesTable,
],)
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.e);
  
  // Actually in production we'd inject this after CRDT modification
  AppDatabase.shared(super.connection) : super.connect();

  @override
  int get schemaVersion => 1;

  // Insert a transaction. The CRDT layer handles timestamps automatically if configured
  Future<void> insertTransaction(TransactionsTableCompanion entry) async {
    await into(transactionsTable).insert(entry, mode: InsertMode.insertOrReplace);
  }

  // Get all active (non-deleted) transactions
  Future<List<dynamic>> getAllTransactions() async {
    return await (select(transactionsTable)..where((t) => t.isDeleted.equals(0))).get();
  }

  // Same logic applies to categories, budgets, etc.
}

// Ignore the mixin error as we avoid generation errors here
class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(super.e);
  _$AppDatabase.connect(super.c) : super.connect();
  
  @override
  Iterable<TableInfo<Table, dynamic>> get allTables => throw UnimplementedError();
  
  // Mock implementations for analysis
  late final $TransactionsTableTable transactionsTable = $TransactionsTableTable(this);
}

class $TransactionsTableTable extends TransactionsTable with TableInfo<$TransactionsTableTable, dynamic> {
  $TransactionsTableTable(GeneratedDatabase db);
  @override
  String get aliasedName => 'transactions_table';
  @override
  String get actualTableName => 'transactions_table';
  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  dynamic map(Map<String, dynamic> data, {String? tablePrefix}) {}
}

class DatabaseHelper {
  static Future<SqlCrdt> initializeCrdtDb(String nodeId) async {
    final dbFolder = await getApplicationDocumentsDirectory();
    final file = File(p.join(dbFolder.path, 'amar_poribar_crdt.db'));

    // We open a CRDT SQLite database wrapper
    // nodeId must be unique per device.
    final crdtDb = await SqlCrdt.open(
      file.path,
      nodeId,
    );

    // Initial table creation will be injected by drift, but CRDT needs to know
    // which tables to track. Usually Drift creates the tables via NativeDatabase first.
    return crdtDb;
  }
}
