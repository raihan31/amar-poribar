import 'package:amar_poribar/data/database/database.dart';
import 'package:drift_dev/api/migrations_native.dart';
import 'package:flutter_test/flutter_test.dart';

import 'generated/schema.dart';
import 'generated/schema_v3.dart' as v3;

void main() {
  late SchemaVerifier verifier;
  setUpAll(() => verifier = SchemaVerifier(GeneratedHelper()));

  test('v3 to v4 keeps rows and adds empty reference tables', () async {
    final schema = await verifier.schemaAt(3);
    final old = v3.DatabaseAtV3(schema.newConnection());
    await old.customStatement(
      "INSERT INTO cached_accounts (id, name, type) VALUES ('a1', 'Cash', 'cash')",
    );
    await old.customStatement(
      'INSERT INTO transactions (id, type, amount_paisa, occurred_at, hlc) '
      "VALUES ('t1', 'expense', 500, '2026-11-01T00:00:00Z', 'h1')",
    );
    await old.close();

    final db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 4);
    await db.close();

    // Reopen to read through the real v4 classes.
    final db2 = AppDatabase(schema.newConnection());
    final acc = await db2.select(db2.cachedAccounts).get();
    expect(acc.single.name, 'Cash');
    expect(acc.single.balancePaisa, 0);
    expect(acc.single.archived, false);
    expect(acc.single.ownerUserId, isNull);
    expect(acc.single.openingBalancePaisa, 0);
    expect((await db2.select(db2.transactions).get()).single.amountPaisa, 500);
    expect(await db2.select(db2.cachedBudgets).get(), isEmpty);
    expect(await db2.select(db2.cachedMembers).get(), isEmpty);
    expect(await db2.select(db2.cachedEntitlements).get(), isEmpty);
    await db2.close();
  });
}
