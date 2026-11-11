import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:amar_poribar/features/transactions/data/local_transaction_repository.dart';
import 'package:amar_poribar/features/transactions/data/transaction_repository.dart';
import 'package:amar_poribar/features/transactions/domain/txn_query.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late AppDatabase db;
  late LocalStore store;
  late LocalTransactionRepository repo;
  var now = DateTime.utc(2026, 11, 10, 6);

  setUp(() async {
    now = DateTime.utc(2026, 11, 10, 6);
    db = AppDatabase.memory();
    store = await LocalStore.open(db, now: () => now);
    repo = LocalTransactionRepository(store, now: () => now);
  });
  tearDown(() => db.close());

  Future<String> add(
    int i, {
    String family = 'f1',
    String? by,
    bool priv = false,
    String? account,
    String? paidBy,
    String? note,
  }) =>
      repo.add(
        familyId: family,
        type: 'expense',
        amountPaisa: 100 + i,
        occurredAt: DateTime.utc(2026, 11, 1).add(Duration(minutes: i)),
        createdBy: by,
        isPrivate: priv,
        accountId: account,
        paidByUserId: paidBy,
        note: note,
      );

  test('120 rows page as 50/50/20 in stable order', () async {
    for (var i = 0; i < 120; i++) {
      await add(i);
    }
    const q = TxnQuery(familyId: 'f1');
    final p1 = await repo.page(q);
    final p2 = await repo.page(q, cursor: p1.nextCursor);
    final p3 = await repo.page(q, cursor: p2.nextCursor);
    expect([p1.items.length, p2.items.length, p3.items.length], [50, 50, 20]);
    expect(p3.nextCursor, isNull);
    final all = [...p1.items, ...p2.items, ...p3.items];
    expect(all.map((t) => t.id).toSet().length, 120);
    for (var i = 1; i < all.length; i++) {
      expect(all[i - 1].occurredAt.compareTo(all[i].occurredAt) >= 0, isTrue);
    }
  });

  test('filters by member and account', () async {
    await add(1, paidBy: 'u1', account: 'a1');
    await add(2, paidBy: 'u2', account: 'a1');
    await add(3, paidBy: 'u1', account: 'a2');
    final byMember =
        await repo.page(const TxnQuery(familyId: 'f1', paidByUserId: 'u1'));
    expect(byMember.items.length, 2);
    final byBoth = await repo.page(
      const TxnQuery(familyId: 'f1', paidByUserId: 'u1', accountId: 'a2'),
    );
    expect(byBoth.items.length, 1);
    final other = await repo.page(const TxnQuery(familyId: 'f2'));
    expect(other.items, isEmpty);
  });

  test('text search and month filter', () async {
    await add(1, note: 'Bazar');
    await add(2, note: 'rent');
    final r = await repo.page(const TxnQuery(familyId: 'f1', text: 'baz'));
    expect(r.items.single.note, 'Bazar');
    final m = await repo.page(const TxnQuery(familyId: 'f1', month: '2026-10'));
    expect(m.items, isEmpty);
    final m2 =
        await repo.page(const TxnQuery(familyId: 'f1', month: '2026-11'));
    expect(m2.items.length, 2);
  });

  test('private rows are hidden from others', () async {
    await add(1, by: 'me', priv: true);
    await add(2, by: 'other', priv: true);
    await add(3, by: 'other');
    final mine =
        await repo.page(const TxnQuery(familyId: 'f1', viewerUserId: 'me'));
    expect(mine.items.length, 2);
    final other =
        await repo.page(const TxnQuery(familyId: 'f1', viewerUserId: 'x'));
    expect(other.items.length, 1);
    final anon = await repo.page(const TxnQuery(familyId: 'f1'));
    expect(anon.items.length, 1);
    expect(
      const TxnQuery(familyId: 'f1', viewerUserId: 'me').includePrivateOf('me'),
      isTrue,
    );
    expect(const TxnQuery(familyId: 'f1').includePrivateOf('me'), isFalse);
  });

  test('delete then restore within 30 days gives a newer HLC', () async {
    final id = await add(1);
    final before = (await repo.byId(id))!.hlc;
    await repo.delete(id);
    expect(await repo.byId(id), isNull);
    final deletedHlc = (await (db.select(db.transactions)
              ..where((t) => t.id.equals(id)))
            .getSingle())
        .hlc;
    now = now.add(const Duration(days: 29));
    await repo.restore(id);
    final t = (await repo.byId(id))!;
    expect(t.deletedAt, isNull);
    expect(t.hlc.compareTo(deletedHlc) > 0, isTrue);
    expect(t.hlc.compareTo(before) > 0, isTrue);
    expect(t.localSeq, greaterThan(2));
  });

  test('restore after 31 days fails with RestoreWindowClosed', () async {
    final id = await add(1);
    await repo.delete(id);
    now = now.add(const Duration(days: 31));
    expect(repo.restore(id), throwsA(isA<RestoreWindowClosed>()));
  });

  test('purge never removes unsynced tombstones', () async {
    final synced = await add(1);
    final unsynced = await add(2);
    await repo.delete(synced);
    await repo.delete(unsynced);
    await store.setMeta('server_pushed_seq', '${await store.currentSeq() - 1}');
    now = now.add(const Duration(days: 40));
    expect(await repo.purgeOldTombstones(), 1);
    final left = await db.select(db.transactions).get();
    expect(left.single.id, unsynced);
  });

  test('day header uses Asia/Dhaka', () {
    final today = DateTime.utc(2026, 11, 10, 20); // 11 Nov 02:00 in Dhaka
    expect(dayHeader('2026-11-11T01:00:00Z', today), 'আজ');
    expect(dayHeader('2026-11-10T10:00:00Z', today), 'গতকাল');
    expect(dayHeader('2026-11-05T10:00:00Z', today), '৫ নভেম্বর');
  });
}
