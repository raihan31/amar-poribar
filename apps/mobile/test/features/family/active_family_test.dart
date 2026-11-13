import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:amar_poribar/domain/models/api/me.dart';
import 'package:amar_poribar/features/family/state/active_family.dart';
import 'package:amar_poribar/features/family/state/budgets_provider.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:amar_poribar/presentation/providers/providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../app/router_test.dart' show FakeAuth;

const f1 = FamilyInfo('f1', 'রহিম পরিবার', 'owner');
const f2 = FamilyInfo('f2', 'শ্বশুরবাড়ি', 'member');

ProviderContainer _container(LocalStore store, List<FamilyInfo> families) {
  final fake = FakeAuth()
    ..set(AuthState(loaded: true, token: 't', families: families));
  final c = ProviderContainer(
    overrides: [
      localStoreProvider.overrideWithValue(store),
      authProvider.overrideWith((ref) => fake),
    ],
  );
  addTearDown(c.dispose);
  return c;
}

Future<void> _ready(ProviderContainer c) =>
    c.read(activeFamilyIdProvider.notifier).loaded;

void main() {
  late LocalStore store;
  setUp(() async => store = await LocalStore.open(AppDatabase.memory()));

  test('defaults to the first family', () async {
    final c = _container(store, [f1, f2]);
    await _ready(c);
    expect(c.read(activeFamilyProvider)?.id, 'f1');
  });

  test('remembers the choice', () async {
    final a = _container(store, [f1, f2]);
    await _ready(a);
    await a.read(activeFamilyIdProvider.notifier).select('f2');
    expect(a.read(activeFamilyProvider)?.id, 'f2');

    final b = _container(store, [f1, f2]);
    await _ready(b);
    expect(b.read(activeFamilyProvider)?.id, 'f2');
    expect(b.read(activeFamilyProvider)?.name, 'শ্বশুরবাড়ি');
  });

  test('removed membership falls back to the first family', () async {
    await store.setMeta(kActiveFamilyKey, 'f2');
    final c = _container(store, [f1]);
    await _ready(c);
    expect(c.read(activeFamilyProvider)?.id, 'f1');
  });

  test('no families gives no active family', () async {
    final c = _container(store, []);
    await _ready(c);
    expect(c.read(activeFamilyProvider), isNull);
  });

  test('switching invalidates the budgets provider', () async {
    for (final f in ['f1', 'f2']) {
      await store.replaceBudgets(f, [
        {
          'id': 'b-$f',
          'categoryId': 'c',
          'month': currentBudgetMonth(),
          'limitPaisa': f == 'f1' ? 1000 : 2000,
          'spentPaisa': 0,
          'level': 'ok',
        },
      ]);
    }
    final c = _container(store, [f1, f2]);
    await _ready(c);
    c.listen(budgetsProvider, (_, __) {});
    await Future<void>.delayed(Duration.zero);
    expect(c.read(budgetsProvider).value?.single.id, 'b-f1');

    await c.read(activeFamilyIdProvider.notifier).select('f2');
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
    expect(c.read(budgetsProvider).value?.single.id, 'b-f2');
  });
}
