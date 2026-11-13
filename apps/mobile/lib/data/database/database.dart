import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import 'tables.dart';

part 'database.g.dart';

@DriftDatabase(
  tables: [
    Transactions,
    CachedCategories,
    CachedAccounts,
    Meta,
    PendingEntries,
  ],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.e);

  /// In-memory database for tests.
  factory AppDatabase.memory() => AppDatabase(NativeDatabase.memory());

  /// On-device database file.
  static Future<AppDatabase> open() async {
    final dir = await getApplicationDocumentsDirectory();
    return AppDatabase(
      NativeDatabase.createInBackground(
        File(p.join(dir.path, 'amar_poribar.db')),
      ),
    );
  }

  @override
  int get schemaVersion => 3;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) => m.createAll(),
        onUpgrade: (m, from, to) async {
          if (from < 2) await m.addColumn(transactions, transactions.localSeq);
          if (from < 3) await m.createTable(pendingEntries);
        },
      );
}
