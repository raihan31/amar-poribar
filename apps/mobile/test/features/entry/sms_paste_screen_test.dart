import 'package:amar_poribar/domain/models/api/draft.dart';
import 'package:amar_poribar/features/entry/data/fake_entry_repository.dart';
import 'package:amar_poribar/features/entry/state/entry_controller.dart';
import 'package:amar_poribar/features/entry/ui/sms_paste_screen.dart';
import 'package:amar_poribar/features/family/data/fake_family_repository.dart';
import 'package:amar_poribar/features/transactions/data/fake_transaction_repository.dart';
import 'package:amar_poribar/presentation/providers/providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../../helpers/pump_app.dart';
import '../transactions/add_expense_fixtures.dart';

const _bkash =
    'You have sent Tk 2,000.00 to 01XXXXX-789. Fee Tk 0.00. Balance Tk 8,450.00. TrxID 9K4L2M7N at 10/11/2026 14:32';

const _unknown = 'Dear customer, your card ending 1234 was used at Shwapno';

final _clock = DateTime.utc(2026, 11, 10, 9);

List<Override> _overrides(
  FakeTransactionRepository repo,
  FakeEntryRepository entries,
) =>
    [
      ...addExpenseOverrides(repo),
      entryRepositoryProvider.overrideWithValue(entries),
      entryAfterSaveProvider.overrideWithValue(() async {}),
      entryClockProvider.overrideWithValue(() => _clock),
    ];

void _clipboard(WidgetTester t, String? text) {
  t.binding.defaultBinaryMessenger.setMockMethodCallHandler(
    SystemChannels.platform,
    (call) async => call.method == 'Clipboard.getData' ? {'text': text} : null,
  );
  addTearDown(
    () => t.binding.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null),
  );
}

void main() {
  testWidgets('a template match shows the card with no API call (AC-03)',
      (t) async {
    final entries = FakeEntryRepository();
    await pumpApp(
      t,
      const SmsPasteScreen(initialText: _bkash),
      overrides: _overrides(FakeTransactionRepository(), entries),
    );
    await t.pumpAndSettle();

    expect(entries.apiCalls, 0);
    expect(find.text('বিকাশ মেসেজ চেনা গেছে · এআই লাগেনি'), findsOneWidget);
    expect(find.text('৳ ২,০০০'), findsOneWidget);
    expect(find.text('০১XXXXX-৭৮৯'), findsOneWidget);
    expect(find.text('৳ ০'), findsOneWidget);
    expect(find.text('বিকাশ'), findsOneWidget);
    expect(find.text('আজ, দুপুর ২:৩২'), findsOneWidget);
    expect(find.text('9K4L2M7N'), findsOneWidget);
    expect(find.text('এই মেসেজ আগে রাখা হয়নি। কোন খাত?'), findsOneWidget);
    expect(find.text('পরিবারকে সাহায্য'), findsOneWidget);
    expect(find.text('বিল'), findsOneWidget);
    expect(find.text('অন্যান্য'), findsOneWidget);
    expect(find.text('না'), findsOneWidget);
    expect(find.text('✓ রাখুন'), findsOneWidget);
  });

  testWidgets('keeping saves paisa, TrxID and source sms, not the raw text',
      (t) async {
    final repo = FakeTransactionRepository();
    await pumpApp(
      t,
      const SmsPasteScreen(initialText: _bkash),
      overrides: _overrides(repo, FakeEntryRepository()),
    );
    await t.pumpAndSettle();

    await t.tap(find.byKey(const Key('sms_keep')));
    await t.pumpAndSettle();

    final row = repo.rows.single;
    expect(row.amountPaisa, 200000);
    expect(row.feePaisa, 0);
    expect(row.trxId, '9K4L2M7N');
    expect(row.source, 'sms');
    expect(row.type, 'expense');
    expect(row.counterparty, '01XXXXX-789');
    expect('${row.note}', isNot(contains('You have sent')));
    expect(row.note, isNot(contains('8,450')));
  });

  testWidgets('a chosen chip decides the category', (t) async {
    final repo = FakeTransactionRepository();
    await pumpApp(
      t,
      const SmsPasteScreen(initialText: _bkash),
      overrides: _overrides(repo, FakeEntryRepository()),
    );
    await t.pumpAndSettle();
    await t.runAsync(
      () => appContainer(t).read(localStoreProvider).replaceCategories([
        for (final k in ['family_support', 'other_expense'])
          {
            'id': 'c-$k',
            'key': k,
            'kind': 'expense',
            'nameEn': k,
            'nameBn': k,
          },
      ]),
    );
    await t.tap(find.byKey(const Key('sms_chip_other_expense')));
    await t.pump();
    await t.tap(find.byKey(const Key('sms_keep')));
    await t.pumpAndSettle();
    expect(repo.rows.single.categoryId, 'c-other_expense');
  });

  testWidgets('a TrxID already on the phone is a duplicate (AC-04)', (t) async {
    final repo = FakeTransactionRepository();
    await pumpApp(
      t,
      const SmsPasteScreen(),
      overrides: _overrides(repo, FakeEntryRepository()),
    );
    final store = appContainer(t).read(localStoreProvider);
    await t.runAsync(
      () => store.addTransaction(
        familyId: FakeFamilyRepository.familyId,
        type: 'expense',
        amountPaisa: 200000,
        trxId: '9K4L2M7N',
      ),
    );
    _clipboard(t, _bkash);
    await t.tap(find.byKey(const Key('sms_paste')));
    await t
        .runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
    await t.pumpAndSettle();

    expect(find.text('এই মেসেজ আগেই রাখা হয়েছে'), findsOneWidget);
    expect(find.text('এই মেসেজ আগে রাখা হয়নি। কোন খাত?'), findsNothing);
    await t.tap(find.byKey(const Key('sms_keep')), warnIfMissed: false);
    await t.pumpAndSettle();
    expect(repo.rows, isEmpty);
  });

  testWidgets('LocalStore.existsTrxId ignores other families and deletions',
      (t) async {
    await pumpApp(t, const SizedBox());
    final store = appContainer(t).read(localStoreProvider);
    await t.runAsync(() async {
      final id = await store.addTransaction(
        familyId: 'f1',
        type: 'expense',
        amountPaisa: 100,
        trxId: 'AAAA1111',
      );
      expect(await store.existsTrxId('f1', 'AAAA1111'), isTrue);
      expect(await store.existsTrxId('f2', 'AAAA1111'), isFalse);
      expect(await store.existsTrxId('f1', 'BBBB2222'), isFalse);
      await store.deleteTransaction(id);
      expect(await store.existsTrxId('f1', 'AAAA1111'), isFalse);
    });
  });

  testWidgets('the paste button reads the clipboard and clears the text',
      (t) async {
    final entries = FakeEntryRepository();
    await pumpApp(
      t,
      const SmsPasteScreen(),
      overrides: _overrides(FakeTransactionRepository(), entries),
    );
    expect(find.text('বিকাশ, নগদ বা রকেটের মেসেজ পেস্ট করুন।'), findsOneWidget);
    _clipboard(t, _bkash);
    await t.tap(find.text('পেস্ট করুন'));
    await t
        .runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
    await t.pumpAndSettle();

    expect(find.text('৳ ২,০০০'), findsOneWidget);
    expect(entries.apiCalls, 0);
    expect(find.textContaining('You have sent'), findsNothing);
  });

  testWidgets('a message with no template goes to the AI once', (t) async {
    final entries = FakeEntryRepository(
      remote: (text) async => const [
        TransactionDraft(
          type: 'expense',
          amountPaisa: 45000,
          feePaisa: 0,
          occurredAt: '2026-11-10T03:00:00.000Z',
          categoryKey: 'bazaar',
          accountType: 'bkash',
          note: 'Shwapno',
          counterparty: null,
          trxId: null,
          source: 'ai_text',
          confidence: 0.8,
        ),
      ],
    );
    await pumpApp(
      t,
      const SmsPasteScreen(initialText: _unknown),
      overrides: _overrides(FakeTransactionRepository(), entries),
    );
    await t.pumpAndSettle();
    expect(entries.apiCalls, 1);
    expect(find.text('মেসেজটি এআই দিয়ে পড়া হয়েছে'), findsOneWidget);
    expect(find.text('৳ ৪৫০'), findsOneWidget);
    expect(entries.queued, isEmpty);
  });

  testWidgets('offline with no template keeps nothing', (t) async {
    final entries = FakeEntryRepository(offline: true);
    await pumpApp(
      t,
      const SmsPasteScreen(initialText: _unknown),
      overrides: _overrides(FakeTransactionRepository(), entries),
    );
    await t.pumpAndSettle();
    expect(find.byKey(const Key('sms_note')), findsOneWidget);
    expect(entries.queued, isEmpty);
  });

  testWidgets('share-intent text on /add/sms?text= is read at once', (t) async {
    final entries = FakeEntryRepository();
    final router = GoRouter(
      initialLocation: '/add/sms?text=${Uri.encodeQueryComponent(_bkash)}',
      routes: [
        GoRoute(
          path: '/add/sms',
          builder: (_, s) =>
              SmsPasteScreen(initialText: s.uri.queryParameters['text']),
        ),
      ],
    );
    await pumpApp(
      t,
      const SizedBox(),
      router: router,
      overrides: _overrides(FakeTransactionRepository(), entries),
    );
    await t.pumpAndSettle();
    expect(find.text('৳ ২,০০০'), findsOneWidget);
    expect(find.text('9K4L2M7N'), findsOneWidget);
    expect(entries.apiCalls, 0);
  });

  testWidgets('"না" forgets the result', (t) async {
    await pumpApp(
      t,
      const SmsPasteScreen(initialText: _bkash),
      overrides: _overrides(FakeTransactionRepository(), FakeEntryRepository()),
    );
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('sms_no')));
    await t.pumpAndSettle();
    expect(find.text('৳ ২,০০০'), findsNothing);
    expect(find.byKey(const Key('sms_paste')), findsOneWidget);
  });
}
