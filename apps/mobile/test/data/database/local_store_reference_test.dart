import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> budget(String id, int limit) => {
      'id': id,
      'categoryId': null,
      'month': '2026-11',
      'limitPaisa': limit,
      'spentPaisa': 10,
      'level': 'ok',
    };

void main() {
  late LocalStore s;
  setUp(() async => s = await LocalStore.open(AppDatabase.memory()));

  test('watchBudgets emits on replace, filtered by family and month', () async {
    final emissions = <List<int>>[];
    final sub = s
        .watchBudgets('f1', '2026-11')
        .listen((r) => emissions.add([for (final b in r) b.limitPaisa]));
    await Future<void>.delayed(const Duration(milliseconds: 20));
    await s.replaceBudgets('f1', [budget('b1', 100)]);
    await s.replaceBudgets('f2', [budget('b9', 999)]);
    await s.replaceBudgets('f1', [budget('b1', 200)]);
    await Future<void>.delayed(const Duration(milliseconds: 50));
    await sub.cancel();
    expect(emissions.first, isEmpty);
    expect(emissions.last, [200]);
    expect(emissions.expand((e) => e), isNot(contains(999)));
  });

  test('replaceBudgets is atomic: a bad row leaves the old rows', () async {
    await s.replaceBudgets('f1', [budget('b1', 100)]);
    await expectLater(
      s.replaceBudgets('f1', [
        budget('b2', 5),
        {'id': 'bad'},
      ]),
      throwsA(anything),
    );
    final rows = await s.watchBudgets('f1', '2026-11').first;
    expect(rows.map((b) => b.id), ['b1']);
  });

  test('members and entitlements round trip', () async {
    await s.replaceMembers('f1', [
      {'userId': 'u1', 'name': 'Rahim', 'role': 'owner', 'phoneLast3': '678'},
    ]);
    expect((await s.watchMembers('f1').first).single.name, 'Rahim');
    await s.replaceEntitlements('f1', {
      'planCode': 'free',
      'memberLimit': 3,
      'aiQuotaMonth': 30,
      'aiUsedMonth': 4,
      'historyMonths': 6,
      'flags': {'ask': false},
    });
    final e = await s.entitlements('f1');
    expect(e!.planCode, 'free');
    expect(e.historyMonths, 6);
    expect(e.flagsJson, '{"ask":false}');
    expect(await s.entitlements('nope'), isNull);
  });

  test('replaceAccounts keeps the archived flag and stores balances', () async {
    await s.replaceAccounts([
      {'id': 'a1', 'name': 'Cash', 'type': 'cash', 'balancePaisa': 1200},
    ]);
    await s.db.update(s.db.cachedAccounts).write(
          const CachedAccountsCompanion(archived: Value(true)),
        );
    await s.replaceAccounts([
      {'id': 'a1', 'name': 'Cash2', 'type': 'cash', 'balancePaisa': 1500},
    ]);
    final a = (await s.watchAccounts().first).single;
    expect(a.name, 'Cash2');
    expect(a.balancePaisa, 1500);
    expect(a.archived, true);
  });
}
