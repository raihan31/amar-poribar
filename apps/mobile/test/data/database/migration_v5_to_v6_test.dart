import 'package:amar_poribar/data/database/database.dart';
import 'package:drift_dev/api/migrations_native.dart';
import 'package:flutter_test/flutter_test.dart';

import 'generated/schema.dart';
import 'generated/schema_v5.dart' as v5;

void main() {
  late SchemaVerifier verifier;
  setUpAll(() => verifier = SchemaVerifier(GeneratedHelper()));

  test('v5 to v6 creates the inbox table and keeps old rows', () async {
    final schema = await verifier.schemaAt(5);
    final old = v5.DatabaseAtV5(schema.newConnection());
    await old.customStatement(
      "INSERT INTO meta (key, value) VALUES ('active_family', 'fam1')",
    );
    await old.close();

    final db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 6);
    await db.close();

    final db2 = AppDatabase(schema.newConnection());
    expect((await db2.select(db2.meta).get()).single.value, 'fam1');
    await db2.into(db2.inboxItems).insert(
          InboxItemsCompanion.insert(
            id: 'i1',
            kind: 'budget',
            title: 't',
            body: 'b',
            createdAt: '2026-11-01T00:00:00Z',
          ),
        );
    final row = (await db2.select(db2.inboxItems).get()).single;
    expect(row.dataJson, '{}');
    expect(row.readAt, isNull);
    expect(row.speechText, isNull);
    await db2.close();
  });
}
