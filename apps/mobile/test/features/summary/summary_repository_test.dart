import 'package:amar_poribar/data/api/ai_api.dart';
import 'package:amar_poribar/data/api/api_exception.dart';
import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:amar_poribar/features/summary/data/summary_repository.dart';
import 'package:amar_poribar/features/transactions/data/local_transaction_repository.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

class _Ai implements AiApi {
  bool fail = false;
  int calls = 0;
  String? lastMonth;

  @override
  Future<MonthlySummary> summary(
    String familyId, {
    String locale = 'bn',
    String? month,
  }) async {
    calls++;
    lastMonth = month;
    if (fail) throw ApiException(0, 'offline');
    return const MonthlySummary(
      locale: 'bn',
      month: '2026-11',
      text: 'এ মাসে মোট ৳ ১,০০০ খরচ।',
      speechText: 'এ মাসে মোট এক হাজার টাকা খরচ।',
      usedAi: true,
    );
  }

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

const _bn = Locale('bn');

void main() {
  late LocalStore store;
  late ApiSummaryRepository repo;
  late _Ai ai;

  setUp(() async {
    store = await LocalStore.open(AppDatabase.memory());
    ai = _Ai();
    repo = ApiSummaryRepository(
      ai,
      store,
      LocalTransactionRepository(store),
      familyId: () => 'f1',
    );
    await store.replaceCategories([
      {
        'id': 'c1',
        'key': 'bazar',
        'kind': 'expense',
        'nameEn': 'Bazar',
        'nameBn': 'বাজার',
      },
    ]);
    Future<void> add(int paisa, DateTime at, {String? cat}) =>
        store.addTransaction(
          familyId: 'f1',
          type: 'expense',
          amountPaisa: paisa,
          categoryId: cat,
          occurredAt: at,
          createdBy: 'u1',
        );
    await add(1680000, DateTime.utc(2026, 11, 3), cat: 'c1');
    await add(2570000, DateTime.utc(2026, 11, 5));
    await add(3930000, DateTime.utc(2026, 10, 5));
  });
  tearDown(() => store.db.close());

  test('loads from the API for the asked month and caches it', () async {
    final s = await repo.load('2026-11', _bn);
    expect(s.usedAi, isTrue);
    expect(ai.lastMonth, '2026-11');
    expect(await store.getMeta('summary:2026-11'), isNotNull);
  });

  test('offline, the last cached summary is used', () async {
    await repo.load('2026-11', _bn);
    ai.fail = true;
    final s = await repo.load('2026-11', _bn);
    expect(s.text, contains('১,০০০'));
  });

  test('offline with no cache, a local template from local totals', () async {
    ai.fail = true;
    final s = await repo.load('2026-11', _bn);
    expect(s.usedAi, isFalse);
    expect(s.text, contains('৳ ৪২,৫০০'));
    expect(s.text, contains('গত মাসের চেয়ে ৳ ৩,২০০ বেশি'));
    expect(s.text, contains('বাজার'));
    expect(s.speechText, contains('বিয়াল্লিশ হাজার পাঁচশো টাকা'));
    expect(s.speechText, isNot(contains('৳')));
  });

  test('no entries gives the empty sentence', () async {
    final s = localSummary(
      month: '2026-12',
      locale: _bn,
      expensePaisa: 0,
      lastMonthExpensePaisa: 0,
      incomePaisa: 0,
    );
    expect(s.text, 'ডিসেম্বর মাসে এখনো কোনো খরচ লেখা হয়নি।');
  });
}
