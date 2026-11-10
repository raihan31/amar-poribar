import 'package:amar_poribar/data/api/api_client.dart';
import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:amar_poribar/data/sync/reference_data_sync.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeRefApi extends ApiClient {
  FakeRefApi() : super(baseUrl: 'http://fake');
  final failing = <String>{};
  int limit = 100;

  T _guard<T>(String n, T v) {
    if (failing.contains(n)) throw ApiException(500, n);
    return v;
  }

  @override
  Future<List<Map<String, dynamic>>> categories(String familyId) async =>
      _guard('categories', [
        {
          'id': 'c1',
          'key': 'bazaar',
          'kind': 'expense',
          'nameEn': 'Bazaar',
          'nameBn': 'বাজার',
          'icon': null,
          'isHidden': false,
        },
      ]);

  @override
  Future<List<Map<String, dynamic>>> accounts(String familyId) async =>
      _guard('accounts', [
        {'id': 'a1', 'name': 'Cash', 'type': 'cash', 'balancePaisa': limit},
      ]);

  @override
  Future<List<Map<String, dynamic>>> budgets(
    String familyId, {
    String? month,
  }) async =>
      _guard('budgets', [
        {
          'id': '$month-overall',
          'categoryId': null,
          'month': month,
          'limitPaisa': limit,
          'spentPaisa': 5,
          'level': 'ok',
        },
      ]);

  @override
  Future<List<Map<String, dynamic>>> members(String familyId) async =>
      _guard('members', [
        {'userId': 'u1', 'name': 'Rahim', 'role': 'owner', 'phoneLast3': '678'},
      ]);

  @override
  Future<Map<String, dynamic>> entitlements(String familyId) async =>
      _guard('entitlements', {
        'planCode': 'free',
        'memberLimit': 3,
        'aiQuotaMonth': 30,
        'aiUsedMonth': 0,
        'historyMonths': null,
        'flags': <String, dynamic>{},
      });
}

void main() {
  late LocalStore store;
  late FakeRefApi api;
  final now = DateTime.utc(2026, 11, 9);
  setUp(() async {
    store = await LocalStore.open(AppDatabase.memory());
    api = FakeRefApi();
  });

  test('refresh caches everything for current and previous month', () async {
    final errors =
        await ReferenceDataSync(api, store, now: () => now).refresh('f1');
    expect(errors, isEmpty);
    expect((await store.categories()).length, 1);
    expect((await store.accounts()).single.balancePaisa, 100);
    expect((await store.watchBudgets('f1', '2026-11').first).length, 1);
    expect((await store.watchBudgets('f1', '2026-10').first).length, 1);
    expect((await store.watchMembers('f1').first).single.name, 'Rahim');
    expect((await store.entitlements('f1'))!.planCode, 'free');
  });

  test('one failing endpoint keeps old data and is reported', () async {
    final sync = ReferenceDataSync(api, store, now: () => now);
    await sync.refresh('f1');
    api.limit = 777;
    api.failing.add('budgets');
    final errors = await sync.refresh('f1');
    expect(errors.single, contains('budgets'));
    expect(
      (await store.watchBudgets('f1', '2026-11').first).single.limitPaisa,
      100,
    );
    expect((await store.accounts()).single.balancePaisa, 777);
  });
}
