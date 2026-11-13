import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/domain/models/api/draft.dart';
import 'package:amar_poribar/features/entry/data/fake_entry_repository.dart';
import 'package:amar_poribar/features/entry/state/entry_controller.dart';
import 'package:amar_poribar/features/entry/ui/category_picker_screen.dart';
import 'package:amar_poribar/features/entry/ui/voice_entry_screen.dart';
import 'package:amar_poribar/features/transactions/data/fake_transaction_repository.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../../helpers/fake_voice_service.dart';
import '../../helpers/fakes.dart';
import '../../helpers/pump_app.dart';
import '../transactions/add_expense_fixtures.dart';

const _said = 'আজ বাজারে আটশো পঞ্চাশ টাকা ক্যাশে';
const _readBack = 'বাজার ও মুদি খাতে আটশো পঞ্চাশ টাকা খরচ। ঠিক আছে?';

List<Override> _overrides({
  required FakeTransactionRepository repo,
  required FakeEntryRepository entries,
  required FakeVoiceService voice,
  FakeClock? clock,
}) =>
    [
      ...addExpenseOverrides(repo),
      entryRepositoryProvider.overrideWithValue(entries),
      entryAfterSaveProvider.overrideWithValue(() async {}),
      voiceServiceProvider.overrideWithValue(voice),
      if (clock != null) entryClockProvider.overrideWithValue(clock.now),
    ];

void main() {
  testWidgets('read-back sentence is exact and starts within 3 s (NFR-14)',
      (t) async {
    final voice = FakeVoiceService(listen: [_said]);
    final entries = FakeEntryRepository();
    final clock = FakeClock();
    await pumpApp(
      t,
      const VoiceEntryScreen(),
      overrides: _overrides(
        repo: FakeTransactionRepository(),
        entries: entries,
        voice: voice,
        clock: clock,
      ),
    );
    await t.pumpAndSettle();

    expect(voice.spoken, [_readBack]);
    expect(find.text('"$_said"'), findsOneWidget);
    expect(find.text('আপনি বললেন:'), findsOneWidget);
    expect(find.text('ঠিক আছে?'), findsOneWidget);
    expect(find.text('আবার শুনুন'), findsOneWidget);
    expect(entries.apiCalls, 0);

    final s = appContainer(t).read(entryControllerProvider);
    expect(
      s.readBackAt!.difference(s.heardAt!),
      lessThanOrEqualTo(const Duration(seconds: 3)),
    );

    await t.tap(find.byKey(const Key('entry_again')));
    await t.pump();
    expect(voice.spoken, [_readBack, _readBack]);
  });

  testWidgets('unknown category speaks the question and opens the picker',
      (t) async {
    final voice = FakeVoiceService(listen: ['পাঁচশো টাকা দিলাম']);
    Object? pickerExtra;
    final router = GoRouter(
      routes: [
        GoRoute(path: '/', builder: (_, __) => const VoiceEntryScreen()),
        GoRoute(
          path: '/add/category',
          builder: (c, s) {
            pickerExtra = s.extra;
            return Scaffold(
              body: TextButton(
                key: const Key('pick_bazaar'),
                onPressed: () => c.pop(
                  const CachedCategory(
                    id: 'c-bazaar',
                    key: 'bazaar',
                    kind: 'expense',
                    nameEn: 'bazaar',
                    nameBn: 'বাজার ও মুদি',
                    isHidden: false,
                  ),
                ),
                child: const Text('picker'),
              ),
            );
          },
        ),
      ],
    );
    await pumpApp(
      t,
      const SizedBox(),
      router: router,
      overrides: _overrides(
        repo: FakeTransactionRepository(),
        entries: FakeEntryRepository(),
        voice: voice,
      ),
    );
    await t.pumpAndSettle();

    expect(voice.spoken.first, 'কিসের জন্য? নিচের ছবিতে চাপ দিন।');
    expect(find.text('picker'), findsOneWidget);
    expect((pickerExtra! as CategoryPickerArgs).amountPaisa, 50000);

    await t.tap(find.byKey(const Key('pick_bazaar')));
    await t.pumpAndSettle();
    expect(find.text('বাজার ও মুদি'), findsOneWidget);
    expect(voice.spoken.last, contains('বাজার ও মুদি খাতে পাঁচশো টাকা'));
  });

  testWidgets('yes saves with source voice', (t) async {
    final repo = FakeTransactionRepository();
    await pumpApp(
      t,
      const VoiceEntryScreen(),
      overrides: _overrides(
        repo: repo,
        entries: FakeEntryRepository(),
        voice: FakeVoiceService(listen: [_said]),
      ),
    );
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('entry_yes')));
    await t.pumpAndSettle();
    expect(repo.rows, hasLength(1));
    expect(repo.rows.single.source, 'voice');
    expect(repo.rows.single.amountPaisa, 85000);
  });

  testWidgets('no discards without saving', (t) async {
    final repo = FakeTransactionRepository();
    await pumpApp(
      t,
      const VoiceEntryScreen(),
      overrides: _overrides(
        repo: repo,
        entries: FakeEntryRepository(),
        voice: FakeVoiceService(listen: [_said]),
      ),
    );
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('entry_no')));
    await t.pumpAndSettle();
    expect(repo.rows, isEmpty);
    expect(find.byKey(const Key('entry_yes')), findsNothing);
  });

  testWidgets('several drafts show one card each with its own buttons',
      (t) async {
    final repo = FakeTransactionRepository();
    final entries = FakeEntryRepository(
      remote: (text) async => [
        for (final (cents, key) in [(50000, 'bazaar'), (20000, 'medical')])
          _draft(cents, key),
      ],
    );
    await pumpApp(
      t,
      const VoiceEntryScreen(),
      overrides: _overrides(
        repo: repo,
        entries: entries,
        voice: FakeVoiceService(
          listen: ['বাজারে পাঁচশো টাকা আর ওষুধে দুইশো টাকা'],
        ),
      ),
    );
    await t.pumpAndSettle();
    expect(find.byKey(const Key('draft_card_0')), findsOneWidget);
    expect(find.byKey(const Key('draft_card_1')), findsOneWidget);
    expect(entries.apiCalls, 1);

    await t.tap(find.byIcon(Icons.check).last);
    await t.pumpAndSettle();
    expect(repo.rows.single.amountPaisa, 20000);
    expect(find.byKey(const Key('draft_card_1')), findsNothing);
  });

  testWidgets('quota exceeded shows the quota note', (t) async {
    await pumpApp(
      t,
      const VoiceEntryScreen(),
      overrides: _overrides(
        repo: FakeTransactionRepository(),
        entries: FakeEntryRepository(quota: true),
        voice: FakeVoiceService(listen: ['দুই কেজি চাল আর মাছ']),
      ),
    );
    await t.pumpAndSettle();
    expect(find.text('আজকের এআই সীমা শেষ। হাতে লিখে রাখুন।'), findsOneWidget);
  });

  testWidgets('offline text is queued and said', (t) async {
    final entries = FakeEntryRepository(offline: true);
    await pumpApp(
      t,
      const VoiceEntryScreen(),
      overrides: _overrides(
        repo: FakeTransactionRepository(),
        entries: entries,
        voice: FakeVoiceService(listen: ['দুই কেজি চাল আর মাছ']),
      ),
    );
    await t.pumpAndSettle();
    expect(entries.queued, ['দুই কেজি চাল আর মাছ']);
    expect(find.byKey(const Key('entry_note')), findsOneWidget);
  });
}

TransactionDraft _draft(int paisa, String key) => TransactionDraft(
      type: 'expense',
      amountPaisa: paisa,
      feePaisa: 0,
      occurredAt: '2026-11-09T04:00:00.000Z',
      categoryKey: key,
      accountType: 'cash',
      note: '',
      counterparty: null,
      trxId: null,
      source: 'ai_text',
      confidence: 0.9,
    );
