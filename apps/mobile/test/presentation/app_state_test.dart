import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:amar_poribar/presentation/providers/providers.dart';

void main() {
  test('dashboard state is read from, and saved to, the local database',
      () async {
    final store = await LocalStore.open(AppDatabase.memory());
    final container = ProviderContainer(
        overrides: [localStoreProvider.overrideWithValue(store)]);
    addTearDown(container.dispose);

    final notifier = container.read(appStateProvider.notifier);
    await notifier.addIncome(5000, note: 'বেতন');
    await notifier.addExpense(850.5, note: 'বাজার');

    final s = container.read(appStateProvider);
    expect(s.totalIncome, 5000);
    expect(s.totalExpense, 850.5);
    expect(s.recent, hasLength(2));
    expect(s.recent.first['category'], isNotEmpty);

    // It is really in the database, not just in memory.
    expect(await store.recent(), hasLength(2));
  });
}
