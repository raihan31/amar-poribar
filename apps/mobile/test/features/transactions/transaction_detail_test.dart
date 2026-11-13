import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/domain/models/role.dart';
import 'package:amar_poribar/features/family/state/family_providers.dart';
import 'package:amar_poribar/features/transactions/data/fake_transaction_repository.dart';
import 'package:amar_poribar/features/transactions/domain/txn_query.dart';
import 'package:amar_poribar/features/transactions/state/add_expense_controller.dart';
import 'package:amar_poribar/features/transactions/ui/add_expense_screen.dart';
import 'package:amar_poribar/features/transactions/ui/transaction_detail_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../goldens/golden_config.dart';
import '../../helpers/pump_app.dart';
import 'add_expense_fixtures.dart';

Transaction _row({
  String id = 't1',
  String createdBy = 'u-ammu',
  String? trxId,
  String? attachmentKey,
  bool isPrivate = true,
}) =>
    Transaction(
      id: id,
      type: 'expense',
      amountPaisa: 85000,
      feePaisa: 0,
      occurredAt: '2026-11-13T11:10:00.000Z', // 17:10 in Dhaka
      categoryId: 'c-bazaar',
      accountId: 'a-cash',
      note: 'ইলিশ, চাল',
      source: 'voice',
      isPrivate: isPrivate,
      hlc: 'h1',
      familyId: 'f-rahim',
      paidByUserId: createdBy,
      createdBy: createdBy,
      trxId: trxId,
      attachmentKey: attachmentKey,
      localSeq: 1,
    );

List<Override> _overrides(
  FakeTransactionRepository repo, {
  FamilyRole role = FamilyRole.owner,
  String me = 'u-abbu',
}) =>
    [
      ...addExpenseOverrides(repo, role: role),
      myUserIdProvider.overrideWith((ref) async => me),
      addExpenseClockProvider.overrideWithValue(
        () => DateTime.utc(2026, 11, 13, 12),
      ),
    ];

Future<void> _pumpDetail(
  WidgetTester t,
  FakeTransactionRepository repo, {
  FamilyRole role = FamilyRole.owner,
  String me = 'u-abbu',
}) async {
  await pumpApp(
    t,
    const TransactionDetailScreen(id: 't1'),
    overrides: _overrides(repo, role: role, me: me),
  );
  await t.pumpAndSettle();
}

void main() {
  group('role matrix', () {
    for (final (role, me) in [
      (FamilyRole.owner, 'u-abbu'),
      (FamilyRole.admin, 'u-ammu'),
    ]) {
      testWidgets('$role edits everyone\'s rows', (t) async {
        final repo = FakeTransactionRepository([_row(createdBy: 'u-dadi')]);
        await _pumpDetail(t, repo, role: role, me: me);
        expect(find.text('বদলান'), findsOneWidget);
        expect(find.text('মুছুন'), findsOneWidget);
        expect(find.text('আপনি শুধু নিজের খরচ বদলাতে পারেন'), findsNothing);
      });
    }

    testWidgets('member edits own row', (t) async {
      final own = FakeTransactionRepository([_row(createdBy: 'u-dadi')]);
      await _pumpDetail(t, own, role: FamilyRole.member, me: 'u-dadi');
      expect(find.text('বদলান'), findsOneWidget);
      expect(find.text('মুছুন'), findsOneWidget);
    });

    testWidgets('member cannot edit another member\'s row', (t) async {
      final other = FakeTransactionRepository([_row(createdBy: 'u-ammu')]);
      await _pumpDetail(t, other, role: FamilyRole.member, me: 'u-dadi');
      expect(find.text('বদলান'), findsNothing);
      expect(find.text('মুছুন'), findsNothing);
      expect(find.text('আপনি শুধু নিজের খরচ বদলাতে পারেন'), findsOneWidget);
    });

    testWidgets('viewer sees no buttons', (t) async {
      final repo = FakeTransactionRepository([_row()]);
      await _pumpDetail(t, repo, role: FamilyRole.viewer, me: 'u-tanvir');
      expect(find.text('বদলান'), findsNothing);
      expect(find.text('মুছুন'), findsNothing);
      expect(find.text('আপনি শুধু নিজের খরচ বদলাতে পারেন'), findsOneWidget);
    });
  });

  testWidgets('shows every field of the entry', (t) async {
    final repo = FakeTransactionRepository([
      _row(trxId: '9K4L2M7N', attachmentKey: 'media/receipt.jpg'),
    ]);
    await _pumpDetail(t, repo);
    expect(find.text('−৳ ৮৫০'), findsOneWidget);
    expect(find.text('আটশো পঞ্চাশ টাকা'), findsOneWidget);
    expect(find.text('বাজার ও মুদি'), findsOneWidget);
    expect(find.text('আজ, বিকাল ৫:১০'), findsOneWidget);
    expect(find.text('ক্যাশ'), findsOneWidget);
    expect(find.text('আম্মু'), findsOneWidget);
    expect(find.text('কণ্ঠ থেকে'), findsOneWidget);
    expect(find.text('9K4L2M7N'), findsOneWidget);
    expect(find.text('ইলিশ, চাল'), findsOneWidget);
    expect(find.text('শুধু আমি'), findsOneWidget);
    expect(find.byKey(const Key('attachment_thumb')), findsOneWidget);
  });

  testWidgets('delete shows the undo banner and restore returns the row', (
    t,
  ) async {
    final repo = FakeTransactionRepository([_row(createdBy: 'u-abbu')]);
    await _pumpDetail(t, repo);
    expect(find.text('ফেরত আনুন'), findsNothing);

    await t.tap(find.text('মুছুন'));
    await t.pumpAndSettle();
    expect(
      find.text('মুছে ফেলা হয়েছে · ৩০ দিন পর্যন্ত ফেরত পাবেন'),
      findsOneWidget,
    );
    expect(await repo.byId('t1'), isNull);

    await t.tap(find.text('ফেরত আনুন'));
    await t.pumpAndSettle();
    expect(await repo.byId('t1'), isNotNull);
    expect(find.text('ফেরত আনুন'), findsNothing);
    expect(find.text('মুছুন'), findsOneWidget);
  });

  testWidgets('editing the amount updates the list', (t) async {
    final repo = FakeTransactionRepository([_row(createdBy: 'u-abbu')]);
    await pumpApp(
      t,
      const AddExpenseScreen(editId: 't1'),
      overrides: _overrides(repo),
    );
    await t.pumpAndSettle();
    expect(find.text('৮৫০'), findsWidgets);
    for (var i = 0; i < 3; i++) {
      await t.tap(find.byKey(const Key('key_back')));
      await t.pump();
    }
    for (final d in '900'.split('')) {
      await t.tap(find.byKey(Key('key_$d')));
      await t.pump();
    }
    await t.tap(find.text('রাখুন'));
    await t.pumpAndSettle();

    final page = await repo.page(
      const TxnQuery(familyId: 'f-rahim', viewerUserId: 'u-abbu'),
    );
    expect(page.items.single.amountPaisa, 90000);
    expect(page.items.single.id, 't1');
    expect(repo.rows, hasLength(1)); // edited in place, not added
  });

  goldenScreen(
    'D5_transaction_detail',
    const TransactionDetailScreen(id: 't1'),
    overrides: _overrides(
      FakeTransactionRepository([_row(createdBy: 'u-ammu')]),
      role: FamilyRole.member,
      me: 'u-dadi',
    ),
  );
}
