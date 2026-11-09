import 'package:flutter_test/flutter_test.dart';

import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/data/database/local_store.dart';

/// Two phones with their own databases and wall clocks.
Future<LocalStore> device(DateTime Function() now) =>
    LocalStore.open(AppDatabase.memory(), now: now);

/// Exchange everything both ways, like a sync with a peer or the server.
Future<void> sync(LocalStore a, LocalStore b) async {
  final fromA = await a.changesSince(null, includePrivate: true);
  final fromB = await b.changesSince(null, includePrivate: true);
  await b.applyChanges(fromA);
  await a.applyChanges(fromB);
}

Future<Map<String, String?>> snapshot(LocalStore s) async {
  final all = await s.changesSince(null, includePrivate: true);
  return {
    for (final r in all)
      r['id'] as String:
          '${r['amountPaisa']}|${r['note']}|${r['deletedAt'] != null}|${r['hlc']}'
  };
}

void main() {
  var clockA = DateTime.utc(2026, 11, 9, 10);
  var clockB = DateTime.utc(2026, 11, 9, 10);

  test('entries made offline on two phones end up on both', () async {
    final a = await device(() => clockA);
    final b = await device(() => clockB);
    await a.addTransaction(
        id: 'a1', type: 'expense', amountPaisa: 85000, note: 'bazaar');
    await b.addTransaction(
        id: 'b1', type: 'income', amountPaisa: 500000, note: 'salary');
    await sync(a, b);
    expect((await snapshot(a)).keys.toSet(), {'a1', 'b1'});
    expect(await snapshot(a), await snapshot(b));
  });

  test('concurrent edits to one record: the later HLC wins on both phones',
      () async {
    final a = await device(() => clockA);
    final b = await device(() => clockB);
    await a.addTransaction(
        id: 'x', type: 'expense', amountPaisa: 1000, note: 'v1');
    await sync(a, b);
    clockA = DateTime.utc(2026, 11, 9, 10, 5);
    clockB = DateTime.utc(2026, 11, 9, 10, 9);
    await a.updateTransaction('x', amountPaisa: 2000, note: 'from A');
    await b.updateTransaction('x', amountPaisa: 3000, note: 'from B'); // later
    await sync(a, b);
    final s = await snapshot(a);
    expect(s['x']!.startsWith('3000|from B|false'), isTrue);
    expect(s, await snapshot(b));
  });

  test('a newer delete beats an older edit and reaches the other phone',
      () async {
    final a = await device(() => clockA);
    final b = await device(() => clockB);
    await a.addTransaction(id: 'd', type: 'expense', amountPaisa: 1000);
    await sync(a, b);
    clockA = DateTime.utc(2026, 11, 9, 11);
    clockB = DateTime.utc(2026, 11, 9, 12);
    await a.updateTransaction('d', note: 'edited');
    await b.deleteTransaction('d');
    await sync(a, b);
    expect((await a.recent()), isEmpty);
    expect((await b.recent()), isEmpty);
    expect(await snapshot(a), await snapshot(b));
  });

  test('applying the same changes twice changes nothing', () async {
    final a = await device(() => clockA);
    final b = await device(() => clockB);
    await a.addTransaction(id: 'i', type: 'expense', amountPaisa: 1);
    final changes = await a.changesSince(null);
    expect(await b.applyChanges(changes), 1);
    expect(await b.applyChanges(changes), 0);
  });

  test('changesSince returns only newer changes, oldest first', () async {
    final a = await device(() => clockA);
    await a.addTransaction(id: '1', type: 'expense', amountPaisa: 1);
    final mark = await a.latestHlc();
    await a.addTransaction(id: '2', type: 'expense', amountPaisa: 2);
    final later = await a.changesSince(mark);
    expect(later.map((r) => r['id']), ['2']);
  });

  test('private entries are not shared unless asked', () async {
    final a = await device(() => clockA);
    await a.addTransaction(
        id: 'p', type: 'expense', amountPaisa: 1, isPrivate: true);
    expect(await a.changesSince(null), isEmpty);
    expect(await a.changesSince(null, includePrivate: true), hasLength(1));
  });

  test('a clock set far in the future is rejected, not merged', () async {
    final a = await device(() => clockA);
    final far = {
      'id': 'f',
      'type': 'expense',
      'amountPaisa': 1,
      'feePaisa': 0,
      'occurredAt': '2026-11-09T10:00:00.000Z',
      'isPrivate': false,
      'source': 'manual',
      'hlc': '2030-01-01T00:00:00.000Z-0000-evil',
    };
    expect(() => a.applyChanges([far]), throwsA(isA<Exception>()));
    expect(await a.changesSince(null, includePrivate: true), isEmpty);
  });

  test('totals add up income and expense including fees for a month', () async {
    final a = await device(() => clockA);
    await a.addTransaction(
        type: 'expense',
        amountPaisa: 85000,
        feePaisa: 500,
        occurredAt: DateTime.utc(2026, 11, 3));
    await a.addTransaction(
        type: 'income',
        amountPaisa: 500000,
        occurredAt: DateTime.utc(2026, 11, 4));
    await a.addTransaction(
        type: 'expense',
        amountPaisa: 999,
        occurredAt: DateTime.utc(2026, 10, 30));
    final t = await a.totals(DateTime.utc(2026, 11), DateTime.utc(2026, 12));
    expect(t.expensePaisa, 85500);
    expect(t.incomePaisa, 500000);
  });

  test('a device keeps its node id and clock across restarts', () async {
    final db = AppDatabase.memory();
    final first = await LocalStore.open(db, now: () => clockA);
    await first.addTransaction(id: 'k', type: 'expense', amountPaisa: 1);
    final second = await LocalStore.open(db, now: () => clockA);
    expect(second.nodeId, first.nodeId);
    await second.addTransaction(id: 'k2', type: 'expense', amountPaisa: 1);
    final rows = await second.changesSince(null);
    expect(rows[1]['hlc'].compareTo(rows[0]['hlc']), greaterThan(0));
  });
}
