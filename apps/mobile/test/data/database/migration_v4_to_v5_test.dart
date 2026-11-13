import 'package:amar_poribar/data/database/database.dart';
import 'package:drift_dev/api/migrations_native.dart';
import 'package:flutter_test/flutter_test.dart';

import 'generated/schema.dart';
import 'generated/schema_v4.dart' as v4;

void main() {
  late SchemaVerifier verifier;
  setUpAll(() => verifier = SchemaVerifier(GeneratedHelper()));

  test('v4 to v5 adds columns and moves rows to the active family', () async {
    final schema = await verifier.schemaAt(4);
    final old = v4.DatabaseAtV4(schema.newConnection());
    await old.customStatement(
      "INSERT INTO meta (key, value) VALUES ('active_family', 'fam1')",
    );
    await old.customStatement(
      'INSERT INTO transactions (id, type, amount_paisa, occurred_at, hlc) '
      "VALUES ('t1', 'expense', 500, '2026-11-01T00:00:00Z', 'h1')",
    );
    await old.close();

    final db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 5);
    await db.close();

    final db2 = AppDatabase(schema.newConnection());
    final row = (await db2.select(db2.transactions).get()).single;
    expect(row.amountPaisa, 500);
    expect(row.familyId, 'fam1');
    expect(row.splitGroupId, isNull);
    expect(row.attachmentKey, isNull);
    expect(row.paidByUserId, isNull);
    expect(row.createdBy, isNull);
    await db2.close();
  });
}
