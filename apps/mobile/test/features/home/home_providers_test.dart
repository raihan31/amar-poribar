import 'package:amar_poribar/core/money/money.dart';
import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:amar_poribar/domain/models/api/me.dart';
import 'package:amar_poribar/features/family/data/fake_family_repository.dart';
import 'package:amar_poribar/features/family/state/active_family.dart';
import 'package:amar_poribar/features/family/state/family_providers.dart';
import 'package:amar_poribar/features/home/data/home_repository.dart';
import 'package:amar_poribar/features/home/state/home_providers.dart';
import 'package:amar_poribar/presentation/providers/providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

const _family =
    FamilyInfo(FakeFamilyRepository.familyId, 'রহিম পরিবার', 'owner');

void main() {
  late LocalStore store;
  late ProviderContainer container;

  setUp(() async {
    store = await LocalStore.open(AppDatabase.memory());
    container = ProviderContainer(
      overrides: [
        localStoreProvider.overrideWithValue(store),
        activeFamilyProvider.overrideWithValue(_family),
        familyRepositoryProvider.overrideWithValue(FakeFamilyRepository()),
        myUserIdProvider.overrideWith((ref) async => FakeFamilyRepository.meId),
        homeClockProvider
            .overrideWithValue(() => DateTime.utc(2026, 11, 9, 12)),
      ],
    );
  });
  tearDown(() async {
    container.dispose();
    await store.db.close();
  });

  Future<void> add(int paisa, DateTime at, String by) => store.addTransaction(
        familyId: FakeFamilyRepository.familyId,
        type: 'expense',
        amountPaisa: paisa,
        occurredAt: at,
        paidByUserId: by,
        createdBy: by,
      );

  test('summary sums this month and compares with last month', () async {
    await add(100000, DateTime.utc(2026, 11, 3), 'u-abbu');
    await add(50000, DateTime.utc(2026, 10, 20), 'u-abbu');
    final sub = container.listen(homeSummaryProvider, (_, __) {});
    addTearDown(sub.close);
    await container.read(homeSummaryProvider.future);
    final s = container.read(homeSummaryProvider).value!;
    expect(s.current.expense, const Money(100000));
    expect(s.previous.expense, const Money(50000));
    expect(s.change, const Money(50000));
  });

  test('a row written by sync reaches the total without a refresh', () async {
    await add(100000, DateTime.utc(2026, 11, 3), 'u-abbu');
    final totals = <int>[];
    final sub = container.listen(
      homeSummaryProvider,
      (_, next) => next.whenData((s) => totals.add(s.current.expense.paisa)),
      fireImmediately: true,
    );
    addTearDown(sub.close);
    await container.read(homeSummaryProvider.future);
    await add(250000, DateTime.utc(2026, 11, 4), 'u-ammu');
    await Future<void>.delayed(const Duration(milliseconds: 100));
    expect(totals.last, 350000);
  });

  test('previousMonth wraps over the year', () {
    expect(previousMonth('2026-01'), '2025-12');
    expect(previousMonth('2026-11'), '2026-10');
  });

  test('the top budget is the highest level, then the fullest', () async {
    Map<String, dynamic> b(String id, String level, int spent) => {
          'id': id,
          'month': '2026-11',
          'limitPaisa': 1000000,
          'spentPaisa': spent,
          'level': level,
        };
    await store.replaceBudgets(FakeFamilyRepository.familyId, [
      b('a', 'ok', 100),
      b('b', 'warning', 800000),
      b('c', 'warning', 900000),
    ]);
    final sub = container.listen(topBudgetWarningProvider, (_, __) {});
    addTearDown(sub.close);
    await Future<void>.delayed(const Duration(milliseconds: 100));
    final top = container.read(topBudgetWarningProvider);
    expect(top?.budget.id, 'c');
    expect(top?.percent, 90);
  });

  test('recent activity keeps the two newest events', () async {
    final c = ProviderContainer(
      overrides: [
        activeFamilyProvider.overrideWithValue(_family),
        myUserIdProvider.overrideWith((ref) async => 'u-abbu'),
        homeRepositoryProvider.overrideWithValue(
          FakeHomeRepository(
            expenses: [
              ActivityItem(
                kind: ActivityKind.expense,
                at: DateTime.utc(2026, 11, 9, 10),
              ),
              ActivityItem(
                kind: ActivityKind.expense,
                at: DateTime.utc(2026, 11, 8, 10),
              ),
            ],
          ),
        ),
        chatActivityProvider.overrideWithValue([
          ActivityItem(
            kind: ActivityKind.voice,
            at: DateTime.utc(2026, 11, 9, 11),
          ),
        ]),
      ],
    );
    addTearDown(c.dispose);
    final sub = c.listen(recentActivityProvider, (_, __) {});
    addTearDown(sub.close);
    await Future<void>.delayed(const Duration(milliseconds: 20));
    final items = c.read(recentActivityProvider);
    expect(
      items.map((e) => e.kind),
      [ActivityKind.voice, ActivityKind.expense],
    );
    expect(items.last.at, DateTime.utc(2026, 11, 9, 10));
  });
}
