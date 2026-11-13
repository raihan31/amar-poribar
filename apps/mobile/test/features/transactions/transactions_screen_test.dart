import 'package:amar_poribar/core/theme/tokens.dart';
import 'package:amar_poribar/domain/models/role.dart';
import 'package:amar_poribar/features/transactions/state/transactions_controller.dart';
import 'package:amar_poribar/features/transactions/ui/transactions_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../../helpers/pump_app.dart';
import 'transactions_fixtures.dart';

Future<void> _settle(WidgetTester t) async {
  await t.pump();
  await t.pump(const Duration(milliseconds: 100));
  await t.pump(const Duration(milliseconds: 100));
}

Future<RecordingTransactionRepository> _open(
  WidgetTester t, {
  List<CsvShare>? shared,
  FamilyRole role = FamilyRole.owner,
  bool empty = false,
}) async {
  final repo = RecordingTransactionRepository(empty ? [] : boardRows());
  await pumpApp(
    t,
    const TransactionsScreen(),
    overrides: listOverrides(repo, shared: shared, role: role),
  );
  await _settle(t);
  return repo;
}

void main() {
  testWidgets('shows আজ and গতকাল headers with the month', (t) async {
    await _open(t);
    expect(find.text('খরচের তালিকা'), findsOneWidget);
    expect(find.text('নভেম্বর ২০২৬'), findsOneWidget);
    expect(find.text('আজ'), findsOneWidget);
    expect(find.text('গতকাল'), findsOneWidget);
    expect(find.text('আম্মু · ক্যাশ · কণ্ঠ থেকে'), findsOneWidget);
    expect(find.text('আব্বু · বিকাশ · এসএমএস থেকে'), findsOneWidget);
    expect(find.text('আব্বু · বিকাশ · হাতে'), findsOneWidget);
  });

  testWidgets('amounts use Bangla digits; expense is danger with a minus', (
    t,
  ) async {
    await _open(t);
    final expense = t.widget<Text>(find.text('−৳ ৮৫০'));
    expect(expense.style?.color, AppTokens.danger);
    expect(find.text('−৳ ২,০০০'), findsOneWidget);
    final income = t.widget<Text>(find.text('+৳ ৬৫,০০০'));
    expect(income.style?.color, AppTokens.green);
  });

  testWidgets('a chip filter reduces the rows', (t) async {
    await _open(t);
    expect(find.text('বিদ্যুৎ বিল'), findsOneWidget);
    expect(find.text('সবাই'), findsOneWidget);
    await t.tap(find.text('আম্মু'));
    await _settle(t);
    expect(find.text('বাজার ও মুদি'), findsOneWidget);
    expect(find.text('বিদ্যুৎ বিল'), findsNothing);
    expect(find.text('বেতন'), findsNothing);
    await t.ensureVisible(find.text('বিকাশ'));
    await t.tap(find.text('বিকাশ'));
    await _settle(t);
    expect(find.text('বিদ্যুৎ বিল'), findsOneWidget);
    expect(find.text('বেতন'), findsNothing);
    expect(find.text('ব্যক্তিগত খরচ'), findsNothing);
    expect(find.text('বেতন'), findsNothing);
    await t.ensureVisible(find.text('সবাই'));
    await t.tap(find.text('সবাই'));
    await _settle(t);
    expect(find.text('বেতন'), findsOneWidget);
  });

  testWidgets('month arrows change the query', (t) async {
    final repo = await _open(t);
    expect(repo.queries.last.month, '2026-11');
    await t.tap(find.bySemanticsLabel('আগের মাস'));
    await _settle(t);
    expect(repo.queries.last.month, '2026-10');
    expect(find.text('অক্টোবর ২০২৬'), findsOneWidget);
    expect(find.text('−৳ ১১১'), findsOneWidget);
    await t.tap(find.bySemanticsLabel('পরের মাস'));
    await _settle(t);
    expect(repo.queries.last.month, '2026-11');
  });

  testWidgets('a private row shows the lock marker', (t) async {
    await _open(t);
    expect(find.text('ব্যক্তিগত খরচ'), findsOneWidget);
    expect(find.text('শুধু আপনি দেখছেন'), findsOneWidget);
    expect(find.byIcon(Icons.lock_outline), findsOneWidget);
    expect(find.text('−৳ ৩০০'), findsOneWidget);
  });

  testWidgets('scrolling to the end loads the next page (120 rows)', (
    t,
  ) async {
    final repo = RecordingTransactionRepository([
      for (var i = 0; i < 120; i++)
        row(
          'r${i.toString().padLeft(3, '0')}',
          at: DateTime.utc(2026, 11, 9, 11).subtract(Duration(minutes: i)),
        ),
    ]);
    await pumpApp(
      t,
      const TransactionsScreen(),
      overrides: listOverrides(repo),
    );
    await _settle(t);
    final c = appContainer(t);
    expect(c.read(transactionsControllerProvider).items, hasLength(50));
    for (var i = 0; i < 60; i++) {
      if (c.read(transactionsControllerProvider).items.length == 120) break;
      await t.drag(find.byType(ListView), const Offset(0, -3000));
      await _settle(t);
    }
    final s = c.read(transactionsControllerProvider);
    expect(s.items, hasLength(120));
    expect(s.nextCursor, isNull);
    expect(repo.cursors.whereType<String>(), isNotEmpty);
  });

  testWidgets('CSV has the header and the visible month', (t) async {
    final shared = <CsvShare>[];
    await _open(t, shared: shared);
    await t.tap(find.text('CSV নিন'));
    await _settle(t);
    expect(shared, hasLength(1));
    final lines = shared.single.csv.trim().split('\n');
    expect(lines.first, 'date,type,amount_paisa,category,account,member,note');
    expect(lines, hasLength(6)); // header + 5 November rows
    expect(lines[1], '2026-11-09,expense,85000,বাজার ও মুদি,ক্যাশ,আম্মু,');
    expect(shared.single.fileName, contains('2026-11'));
  });

  test('CSV quotes commas, quotes and line breaks', () {
    expect(csvField('a,b'), '"a,b"');
    expect(csvField('say "hi"'), '"say ""hi"""');
    expect(csvField('x\ny'), '"x\ny"');
    expect(csvField('plain'), 'plain');
    expect(csvField('=1+1'), "'=1+1");
  });

  testWidgets('a viewer does not see the CSV button', (t) async {
    await _open(t, role: FamilyRole.viewer);
    expect(find.text('CSV নিন'), findsNothing);
  });

  testWidgets('empty month shows the empty state', (t) async {
    await _open(t, empty: true);
    expect(find.text('এ মাসে কোনো খরচ নেই'), findsOneWidget);
    expect(find.text('বলে খরচ লিখুন'), findsOneWidget);
  });

  testWidgets('tapping a row opens /txn/:id and the big button opens /add', (
    t,
  ) async {
    final repo = RecordingTransactionRepository(boardRows());
    final seen = <String>[];
    final router = GoRouter(
      routes: [
        GoRoute(path: '/', builder: (_, __) => const TransactionsScreen()),
        GoRoute(
          path: '/txn/:id',
          builder: (_, s) {
            seen.add('/txn/${s.pathParameters['id']}');
            return const Scaffold(body: Text('detail'));
          },
        ),
        GoRoute(
          path: '/add',
          builder: (_, __) {
            seen.add('/add');
            return const Scaffold(body: Text('add'));
          },
        ),
      ],
    );
    await pumpApp(
      t,
      const SizedBox(),
      overrides: listOverrides(repo),
      router: router,
    );
    await _settle(t);
    await t.tap(find.text('বিদ্যুৎ বিল'));
    await t.pumpAndSettle();
    expect(seen, ['/txn/t3']);
    Navigator.of(t.element(find.text('detail'))).pop();
    await t.pumpAndSettle();
    await t.tap(find.text('+ নতুন খরচ লিখুন'));
    await _settle(t);
    expect(seen.last, '/add');
  });
}
