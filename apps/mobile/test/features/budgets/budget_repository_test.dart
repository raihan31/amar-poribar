import 'dart:convert';

import 'package:amar_poribar/data/api/api_exception.dart';
import 'package:amar_poribar/data/api/budget_api.dart';
import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:amar_poribar/features/budgets/data/budget_repository.dart';
import 'package:flutter_test/flutter_test.dart';

class _Api implements BudgetApi {
  bool offline = false;
  final calls = <(String?, Map<String, dynamic>)>[];

  @override
  Future<void> setBudgets(
    String familyId,
    Map<String, dynamic> body, {
    String? month,
  }) async {
    if (offline) throw ApiException(0, 'offline');
    calls.add((month, body));
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  late LocalStore store;
  late _Api api;
  late ApiBudgetRepository repo;

  setUp(() async {
    store = await LocalStore.open(AppDatabase.memory());
    api = _Api();
    repo = ApiBudgetRepository(store, api, 'f1');
  });
  tearDown(() => store.db.close());

  test(
    'put sends PUT with the month and shows the new limit at once',
    () async {
      final sent = await repo.put(
        [const BudgetInput('c1', 1000000)],
        month: '2026-11',
      );
      expect(sent, isTrue);
      expect(api.calls.single.$1, '2026-11');
      expect(api.calls.single.$2['budgets'], [
        {'categoryId': 'c1', 'limitPaisa': 1000000},
      ]);
      final shown = await repo.watch('2026-11').first;
      expect(shown.single.limitPaisa, 1000000);
    },
  );

  test(
    'offline edits are queued in Meta(budget_patch) and sent later',
    () async {
      api.offline = true;
      final sent = await repo.put(
        [const BudgetInput(null, 5000000)],
        month: '2026-11',
      );
      expect(sent, isFalse);
      final queued = jsonDecode((await store.getMeta('budget_patch'))!) as Map;
      expect(queued['2026-11'], isNotEmpty);
      api.offline = false;
      await repo.flushQueued();
      expect(api.calls, hasLength(1));
      expect(await store.getMeta('budget_patch'), isNull);
    },
  );
}
