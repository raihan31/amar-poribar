import 'package:flutter_test/flutter_test.dart';

import 'package:amar_poribar/data/api/api_client.dart';
import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:amar_poribar/data/sync/sync_service.dart';

/// A tiny in-memory stand-in for apps/api's sync endpoint: per-record greater HLC wins, rows are
/// delivered by a server sequence cursor, and the page size is small to exercise paging.
/// (The real endpoint is covered by apps/api/scripts/e2e.mjs against Postgres.)
class FakeServerApi extends ApiClient {
  FakeServerApi() : super(baseUrl: 'http://fake');
  final rows = <String, Map<String, dynamic>>{};
  final seqOf = <String, int>{};
  int seq = 0;
  int calls = 0;
  bool offline = false;
  final pushedBatches = <int>[];

  @override
  Future<SyncResponse> sync(String familyId, String nodeId, String? cursor,
      List<Map<String, dynamic>> changes) async {
    if (offline) throw ApiException(0, 'offline');
    calls++;
    pushedBatches.add(changes.length);
    var applied = 0;
    for (final c in changes) {
      final existing = rows[c['id']];
      if (existing != null &&
          (existing['hlc'] as String).compareTo(c['hlc'] as String) >= 0)
        continue;
      rows[c['id'] as String] = Map<String, dynamic>.from(c);
      seqOf[c['id'] as String] = ++seq;
      applied++;
    }
    final after = int.parse(cursor ?? '0');
    final newer = seqOf.entries.where((e) => e.value > after).toList()
      ..sort((a, b) => a.value.compareTo(b.value));
    final page = newer.take(3).toList();
    return SyncResponse(
      '${page.isEmpty ? after : page.last.value}',
      newer.length > 3,
      applied,
      const [],
      [for (final e in page) rows[e.key]!],
    );
  }
}

Future<LocalStore> phone(DateTime Function() now) =>
    LocalStore.open(AppDatabase.memory(), now: now);

void main() {
  final t = DateTime.utc(2026, 11, 9, 10);

  test('two phones converge through the server, across several pages',
      () async {
    final server = FakeServerApi();
    final a = await phone(() => t);
    final b = await phone(() => t);
    for (var i = 0; i < 7; i++) {
      await a.addTransaction(id: 'a$i', type: 'expense', amountPaisa: 100 + i);
    }
    await b.addTransaction(id: 'b0', type: 'income', amountPaisa: 5000);

    await SyncService(a, server).sync('f1');
    await SyncService(b, server).sync('f1');
    await SyncService(a, server).sync('f1');

    Future<Set<String>> ids(LocalStore s) async => {
          for (final r in (await s.changesAfter(0, includePrivate: true)).rows)
            r['id'] as String
        };
    expect(await ids(a), {for (var i = 0; i < 7; i++) 'a$i', 'b0'});
    expect(await ids(b), await ids(a));
  });

  test('a second sync with nothing new sends nothing and changes nothing',
      () async {
    final server = FakeServerApi();
    final a = await phone(() => t);
    await a.addTransaction(id: 'x', type: 'expense', amountPaisa: 1);
    final svc = SyncService(a, server);
    final first = await svc.sync('f1');
    expect(first.pushed, 1);
    server.pushedBatches.clear();
    final second = await svc.sync('f1');
    expect(second.pushed, 0);
    expect(second.pulled, 0,
        reason:
            'our own entry coming back is the same HLC, so it is not re-applied');
    expect(server.pushedBatches.every((n) => n == 0), isTrue);
  });

  test('what we merged from the server is not pushed straight back', () async {
    final server = FakeServerApi();
    final a = await phone(() => t);
    final b = await phone(() => t);
    await a.addTransaction(id: 'from-a', type: 'expense', amountPaisa: 1);
    await SyncService(a, server).sync('f1');
    final res = await SyncService(b, server).sync('f1');
    expect(res.pulled, 1);
    server.pushedBatches.clear();
    await SyncService(b, server).sync('f1');
    expect(server.pushedBatches.reduce((x, y) => x + y), 0);
  });

  test(
      'offline: the error surfaces and nothing is lost; the next sync catches up',
      () async {
    final server = FakeServerApi();
    final a = await phone(() => t);
    await a.addTransaction(id: 'o', type: 'expense', amountPaisa: 1);
    server.offline = true;
    await expectLater(
        SyncService(a, server).sync('f1'), throwsA(isA<ApiException>()));
    server.offline = false;
    final res = await SyncService(a, server).sync('f1');
    expect(res.pushed, 1);
    expect(server.rows.keys, ['o']);
  });

  test('an edit made after a sync is pushed on the next one', () async {
    final server = FakeServerApi();
    final a = await phone(() => t);
    await a.addTransaction(id: 'e', type: 'expense', amountPaisa: 1);
    final svc = SyncService(a, server);
    await svc.sync('f1');
    await a.updateTransaction('e', amountPaisa: 99);
    await svc.sync('f1');
    expect(server.rows['e']!['amountPaisa'], 99);
  });

  test(
      'categories and accounts are looked up by key and type for saved entries',
      () async {
    final a = await phone(() => t);
    await a.replaceCategories([
      {
        'id': 'c1',
        'key': 'bazaar',
        'kind': 'expense',
        'nameEn': 'Bazaar',
        'nameBn': 'বাজার',
        'icon': '🛒',
        'isHidden': false
      },
    ]);
    await a.replaceAccounts([
      {'id': 'a1', 'name': 'Cash', 'type': 'cash'},
      {'id': 'a2', 'name': 'bKash', 'type': 'bkash'},
    ]);
    expect(await a.categoryIdForKey('bazaar'), 'c1');
    expect(await a.categoryIdForKey('nope'), isNull);
    expect(await a.accountIdForType('bkash'), 'a2');
    expect(await a.accountIdForType(null), isNull);
  });
}
