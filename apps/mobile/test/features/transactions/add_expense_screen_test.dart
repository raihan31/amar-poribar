import 'package:amar_poribar/app/redirects.dart';
import 'package:amar_poribar/domain/models/role.dart';
import 'package:amar_poribar/features/transactions/data/fake_transaction_repository.dart';
import 'package:amar_poribar/features/transactions/ui/add_expense_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../../helpers/pump_app.dart';
import 'add_expense_fixtures.dart';

Future<void> _typeAmount(WidgetTester t, String latin) async {
  for (final d in latin.split('')) {
    await t.tap(find.byKey(Key('key_$d')));
    await t.pump();
  }
}

Future<void> _pump(
  WidgetTester t,
  FakeTransactionRepository repo, {
  FamilyRole role = FamilyRole.owner,
}) async {
  await pumpApp(
    t,
    const AddExpenseScreen(),
    overrides: addExpenseOverrides(repo, role: role),
  );
  await t.pumpAndSettle();
}

Future<void> _save(WidgetTester t) async {
  await t.tap(find.text('রাখুন'));
  await t.pumpAndSettle();
}

void main() {
  testWidgets('keypad input ৮৫০ produces 85000 paisa', (t) async {
    final repo = FakeTransactionRepository();
    await _pump(t, repo);
    await _typeAmount(t, '850');
    expect(find.text('৮৫০'), findsWidgets);
    await t.tap(find.byKey(const Key('cat_c-bazaar')));
    await _save(t);
    expect(repo.rows.single.amountPaisa, 85000);
    expect(repo.rows.single.source, 'manual');
    expect(repo.rows.single.categoryId, 'c-bazaar');
    expect(repo.rows.single.accountId, 'a-cash');
    expect(repo.rows.single.type, 'expense');
  });

  testWidgets('words line reads আটশো পঞ্চাশ টাকা', (t) async {
    await _pump(t, FakeTransactionRepository());
    await _typeAmount(t, '850');
    expect(find.text('আটশো পঞ্চাশ টাকা'), findsOneWidget);
    expect(find.text('শুনুন'), findsOneWidget);
  });

  testWidgets('transfer hides category and saves without one', (t) async {
    final repo = FakeTransactionRepository();
    await _pump(t, repo);
    expect(find.text('কোন খাতে?'), findsOneWidget);
    await t.tap(find.byKey(const Key('type_transfer')));
    await t.pumpAndSettle();
    expect(find.text('কোন খাতে?'), findsNothing);
    await _typeAmount(t, '5');
    await _save(t);
    expect(repo.rows.single.type, 'transfer');
    expect(repo.rows.single.categoryId, isNull);
  });

  testWidgets('hidden and archived items are not offered', (t) async {
    await _pump(t, FakeTransactionRepository());
    expect(find.text('গ্যাস বিল'), findsNothing);
    expect(find.text('পুরোনো'), findsNothing);
    expect(find.text('বিকাশ'), findsOneWidget);
    await t.tap(find.byKey(const Key('type_income')));
    await t.pumpAndSettle();
    expect(find.text('বেতন'), findsOneWidget);
    expect(find.text('বাজার ও মুদি'), findsNothing);
  });

  testWidgets('private flag is stored', (t) async {
    final repo = FakeTransactionRepository();
    await _pump(t, repo);
    await _typeAmount(t, '100');
    await t.tap(find.byKey(const Key('cat_c-rent')));
    await t.ensureVisible(find.byKey(const Key('private_toggle')));
    await t.tap(find.byKey(const Key('private_toggle')));
    await t.pump();
    await _save(t);
    expect(repo.rows.single.isPrivate, isTrue);
  });

  testWidgets('validation: zero, missing category, above one crore', (t) async {
    final repo = FakeTransactionRepository();
    await _pump(t, repo);
    await _save(t);
    expect(find.text('আগে টাকার অঙ্ক লিখুন।'), findsOneWidget);
    await _typeAmount(t, '5');
    await _save(t);
    expect(find.text('কোন খাতে, বেছে নিন।'), findsOneWidget);
    await t.tap(find.byKey(const Key('cat_c-rent')));
    await _typeAmount(t, '0000000');
    await _save(t); // 50,000,000 taka
    expect(find.text('এক কোটি টাকার বেশি রাখা যায় না।'), findsOneWidget);
    expect(repo.rows, isEmpty);
  });

  testWidgets('exactly ৳1 crore saves', (t) async {
    final repo = FakeTransactionRepository();
    await _pump(t, repo);
    await _typeAmount(t, '10000000');
    await t.tap(find.byKey(const Key('cat_c-rent')));
    await _save(t);
    expect(repo.rows.single.amountPaisa, 1000000000);
  });

  testWidgets('owner can pick another payer; member cannot', (t) async {
    final repo = FakeTransactionRepository();
    await _pump(t, repo);
    expect(find.text('আম্মু'), findsOneWidget);
    await t.ensureVisible(find.text('আম্মু'));
    await t.tap(find.text('আম্মু'));
    await t.pump();
    await _typeAmount(t, '7');
    await t.ensureVisible(find.byKey(const Key('cat_c-rent')));
    await t.tap(find.byKey(const Key('cat_c-rent')));
    await _save(t);
    expect(repo.rows.single.paidByUserId, 'u-ammu');
    expect(repo.rows.single.createdBy, 'u-abbu');
  });

  testWidgets('a member only sees themselves as payer', (t) async {
    await _pump(t, FakeTransactionRepository(), role: FamilyRole.member);
    expect(find.text('আম্মু'), findsNothing);
    expect(find.text('আব্বু'), findsOneWidget);
  });

  testWidgets('viewer role cannot open the route', (t) async {
    final router = GoRouter(
      initialLocation: Routes.add,
      routes: [
        GoRoute(
          path: Routes.add,
          builder: (_, __) => const AddExpenseScreen(),
        ),
        GoRoute(
          path: Routes.home,
          builder: (_, __) => const Scaffold(body: Text('HOME')),
        ),
      ],
    );
    await pumpApp(
      t,
      const SizedBox(),
      router: router,
      overrides: addExpenseOverrides(
        FakeTransactionRepository(),
        role: FamilyRole.viewer,
      ),
    );
    await t.pumpAndSettle();
    expect(find.text('HOME'), findsOneWidget);
    expect(find.byType(AddExpenseScreen), findsNothing);
  });

  testWidgets('undo within 6 s removes the row', (t) async {
    final repo = FakeTransactionRepository();
    await _pump(t, repo);
    await _typeAmount(t, '850');
    await t.tap(find.byKey(const Key('cat_c-bazaar')));
    await _save(t);
    expect(repo.rows, hasLength(1));
    expect(find.text('রাখা হয়েছে'), findsOneWidget);
    await t.pump(const Duration(seconds: 3));
    await t.tap(find.text('বাতিল করুন'));
    await t.pumpAndSettle();
    expect(repo.rows, isEmpty);
  });

  testWidgets('snackbar goes away after 6 s', (t) async {
    final repo = FakeTransactionRepository();
    await _pump(t, repo);
    await _typeAmount(t, '850');
    await t.tap(find.byKey(const Key('cat_c-bazaar')));
    await _save(t);
    await t.pump(const Duration(seconds: 7));
    await t.pumpAndSettle();
    expect(find.text('রাখা হয়েছে'), findsNothing);
    expect(repo.rows, hasLength(1));
  });
}
