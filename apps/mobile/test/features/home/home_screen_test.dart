import 'package:amar_poribar/core/money/money.dart';
import 'package:amar_poribar/core/theme/ui_scale.dart';
import 'package:amar_poribar/domain/models/api/me.dart';
import 'package:amar_poribar/features/family/data/fake_family_repository.dart';
import 'package:amar_poribar/features/family/state/active_family.dart';
import 'package:amar_poribar/features/family/state/family_providers.dart';
import 'package:amar_poribar/features/home/data/home_repository.dart';
import 'package:amar_poribar/features/home/state/home_providers.dart';
import 'package:amar_poribar/features/home/ui/home_screen.dart';
import 'package:amar_poribar/features/home/ui/simple_home_screen.dart';
import 'package:amar_poribar/presentation/providers/providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../../helpers/pump_app.dart';

const _family =
    FamilyInfo(FakeFamilyRepository.familyId, 'রহিম পরিবার', 'owner');

// 12:00 UTC = 18:00 in Dhaka.
final _evening = DateTime.utc(2026, 11, 9, 12);

List<Override> _base({
  HomeRepository? home,
  String? me,
  DateTime? now,
  List<ActivityItem> chat = const [],
  bool budgets = false,
}) =>
    [
      activeFamilyProvider.overrideWithValue(_family),
      homeClockProvider.overrideWithValue(() => now ?? _evening),
      if (home != null) homeRepositoryProvider.overrideWithValue(home),
      if (me != null) myUserIdProvider.overrideWith((ref) async => me),
      chatActivityProvider.overrideWithValue(chat),
      if (budgets) topBudgetWarningProvider.overrideWith(realTopBudgetWarning),
    ];

Future<void> _settle(WidgetTester t) async {
  await t.pump();
  await t.pump(const Duration(milliseconds: 50));
  await t.pump(const Duration(milliseconds: 50));
}

Future<void> _seedBudgets(
  WidgetTester t,
  List<Map<String, dynamic>> rows,
) async {
  final store = appContainer(t).read(localStoreProvider);
  await t.runAsync(
    () => store.replaceBudgets(FakeFamilyRepository.familyId, rows),
  );
  await _settle(t);
}

Map<String, dynamic> _budget(String id, String level, int spent) => {
      'id': id,
      'month': '2026-11',
      'limitPaisa': 1000000,
      'spentPaisa': spent,
      'level': level,
    };

GoRouter _router() => GoRouter(
      initialLocation: '/home',
      routes: [
        GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
        GoRoute(path: '/buzz', builder: (_, s) => Text('BUZZ ${s.uri}')),
        GoRoute(path: '/talk', builder: (_, __) => const Text('TALK')),
      ],
    );

/// Drift closes its query streams on a zero-length timer; unmount and let it fire.
void homeTest(String name, Future<void> Function(WidgetTester t) body) {
  testWidgets(name, (t) async {
    await body(t);
    await t.pumpWidget(const SizedBox());
    await t.pump(const Duration(milliseconds: 10));
  });
}

void main() {
  homeTest('shows the month summary in Bangla', (t) async {
    await pumpApp(
      t,
      const HomeScreen(),
      overrides: _base(home: FakeHomeRepository(), budgets: true),
    );
    await _settle(t);
    expect(find.text('শুভ সন্ধ্যা, আব্বু'), findsOneWidget);
    expect(find.text('আমার পরিবার'), findsOneWidget);
    expect(find.text('নভেম্বরে খরচ'), findsOneWidget);
    expect(find.text('৳ ৪২,৫০০'), findsOneWidget);
    expect(find.text('গত মাসের চেয়ে ৳ ৩,২০০ বেশি'), findsOneWidget);
    expect(find.text('শুনুন'), findsOneWidget);
    expect(find.text('বলে খরচ লিখুন'), findsOneWidget);
    expect(find.text('কম্পন'), findsOneWidget);
    expect(find.text('কথা'), findsOneWidget);
    expect(find.text('ভিডিও'), findsOneWidget);
    expect(find.text('সবুজ = অনলাইন · ধূসর = অফলাইন'), findsOneWidget);
    expect(find.text('আম্মু'), findsOneWidget);
  });

  homeTest('greeting follows the time of day', (t) async {
    final cases = {
      DateTime.utc(2026, 11, 9, 0): 'সুপ্রভাত, আব্বু', // 06:00
      DateTime.utc(2026, 11, 9, 6): 'শুভ দুপুর, আব্বু', // 12:00
      DateTime.utc(2026, 11, 9, 12): 'শুভ সন্ধ্যা, আব্বু', // 18:00
      DateTime.utc(2026, 11, 9, 17): 'শুভ রাত্রি, আব্বু', // 23:00
    };
    for (final e in cases.entries) {
      await pumpApp(
        t,
        const HomeScreen(),
        overrides: _base(home: FakeHomeRepository(), now: e.key),
      );
      await _settle(t);
      expect(find.text(e.value), findsOneWidget, reason: '${e.key}');
    }
  });

  homeTest('warning strip names the fullest budget and the admin', (t) async {
    await pumpApp(
      t,
      const HomeScreen(),
      overrides: _base(home: FakeHomeRepository(), budgets: true),
    );
    await _settle(t);
    await _seedBudgets(t, [
      _budget('b1', 'warning', 800000),
      _budget('b2', 'exceeded', 1200000),
    ]);
    expect(find.text('মোট বাজেট ১২০% শেষ'), findsOneWidget);
    expect(find.text('আম্মুকে জানান'), findsOneWidget);
  });

  homeTest('warning strip is hidden when every budget is ok', (t) async {
    await pumpApp(
      t,
      const HomeScreen(),
      overrides: _base(home: FakeHomeRepository(), budgets: true),
    );
    await _seedBudgets(t, [_budget('b1', 'ok', 100000)]);
    expect(find.text('আম্মুকে জানান'), findsNothing);
    expect(find.textContaining('বাজেট'), findsNothing);
  });

  homeTest('"আম্মুকে জানান" opens /buzz with the phrase and recipient',
      (t) async {
    await pumpApp(
      t,
      const SizedBox(),
      router: _router(),
      overrides: _base(home: FakeHomeRepository(), budgets: true),
    );
    await _seedBudgets(t, [_budget('b1', 'warning', 800000)]);
    await t.tap(find.text('আম্মুকে জানান'));
    await _settle(t);
    final shown = find.textContaining('BUZZ').evaluate().single.widget as Text;
    final uri = Uri.parse(shown.data!.substring('BUZZ '.length));
    expect(uri.path, '/buzz');
    expect(uri.queryParameters['to'], 'u-ammu');
    expect(uri.queryParameters['phrase'], 'বাজেট শেষ');
  });

  homeTest('a member sees the mic', (t) async {
    await pumpApp(
      t,
      const HomeScreen(),
      overrides: _base(home: FakeHomeRepository()),
    );
    await _settle(t);
    expect(find.text('বলে খরচ লিখুন'), findsOneWidget);
    expect(find.text('বিদেশ থেকে পাঠানো টাকা'), findsNothing);
  });

  homeTest('a viewer does not see the mic but sees the remittance card',
      (t) async {
    await pumpApp(
      t,
      const HomeScreen(),
      overrides: _base(home: FakeHomeRepository(), me: 'u-tanvir'),
    );
    await _settle(t);
    expect(find.text('বলে খরচ লিখুন'), findsNothing);
    expect(find.text('বিদেশ থেকে পাঠানো টাকা'), findsOneWidget);
  });

  homeTest('tapping "কম্পন" opens /buzz', (t) async {
    await pumpApp(
      t,
      const SizedBox(),
      router: _router(),
      overrides: _base(home: FakeHomeRepository()),
    );
    await _settle(t);
    await t.tap(find.text('কম্পন'));
    await _settle(t);
    expect(find.textContaining('BUZZ'), findsOneWidget);
  });

  homeTest('tapping an avatar opens the member sheet', (t) async {
    await pumpApp(
      t,
      const SizedBox(),
      router: _router(),
      overrides: _base(home: FakeHomeRepository()),
    );
    await _settle(t);
    await t.tap(find.text('দাদি'));
    await t.pumpAndSettle();
    expect(find.text('কম্পন'), findsNWidgets(2));
    expect(find.text('ভিডিও'), findsNWidgets(2));
  });

  homeTest('latest activity merges chat voice notes and expenses', (t) async {
    final home = FakeHomeRepository(
      expenses: [
        ActivityItem(
          kind: ActivityKind.expense,
          at: DateTime.utc(2026, 11, 9, 10),
          id: 't1',
          memberId: 'u-abbu',
          note: 'বিদ্যুৎ বিল',
          amountPaisa: 234000,
        ),
      ],
    );
    await pumpApp(
      t,
      const HomeScreen(),
      overrides: _base(
        home: home,
        chat: [
          ActivityItem(
            kind: ActivityKind.voice,
            at: DateTime.utc(2026, 11, 9, 11),
            memberId: 'u-ammu',
            voiceSeconds: 12,
          ),
        ],
      ),
    );
    await _settle(t);
    expect(find.text('আম্মু ভয়েস পাঠিয়েছেন · ০:১২'), findsOneWidget);
    expect(find.text('আব্বু লিখেছেন: বিদ্যুৎ বিল'), findsOneWidget);
    expect(find.text('−৳ ২,৩৪০'), findsOneWidget);
  });

  homeTest('Simple mode selects the simple variant', (t) async {
    await pumpApp(
      t,
      const HomeScreen(),
      overrides: [
        ..._base(home: FakeHomeRepository()),
        uiScaleProvider.overrideWith((ref) => UiScale.simple),
      ],
    );
    await _settle(t);
    expect(find.byType(SimpleHomeScreen), findsOneWidget);
    expect(find.text('বলে খরচ লিখুন'), findsNothing);
  });

  homeTest(
      "AC-01: a second member's synced expense updates the total in one frame",
      (t) async {
    final home = FakeHomeRepository(
      summary: const HomeSummary(
        current: MonthTotals(expense: Money(100000)),
        previous: MonthTotals(),
      ),
    );
    await pumpApp(t, const HomeScreen(), overrides: _base(home: home));
    await _settle(t);
    expect(find.text('৳ ১,০০০'), findsOneWidget);
    // The sync engine adds the other member's expense; one frame later the total shows it.
    home.emit(
      const HomeSummary(
        current: MonthTotals(expense: Money(350000)),
        previous: MonthTotals(),
      ),
    );
    await t.pump();
    expect(find.text('৳ ৩,৫০০'), findsOneWidget);
    expect(find.text('৳ ১,০০০'), findsNothing);
  });
}
