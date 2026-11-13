import 'package:amar_poribar/features/settings/state/preferences_controller.dart';
import 'package:amar_poribar/features/settings/ui/settings_screen.dart';
import 'package:amar_poribar/presentation/providers/providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../../helpers/pump_app.dart';

const _rows = [
  'সেটিং',
  'সহজ মোড',
  'ভাষা',
  'সংখ্যা',
  'রোজ মনে করান',
  'কম্পন ও আওয়াজ',
  'রাত ১০টা থেকে সকাল ৬টা চুপ',
  'কাছের ফোনের সাথে সিঙ্ক',
  'খরচের তালিকা নামান (CSV)',
  'খাত ও অ্যাকাউন্ট',
  'কীভাবে ব্যবহার করবেন (শুনুন)',
  'গোপনীয়তা নীতি',
  'আমার তথ্য মুছে দিন',
];

List<Override> _overrides(
  List<(String, String)> pushed,
  List<TimeOfDay> picks,
) => [
  preferencesPushProvider.overrideWithValue((_) async => true),
  quietHoursPushProvider.overrideWithValue((s, e) async {
    pushed.add((s, e));
    return true;
  }),
  settingsTimePickerProvider.overrideWithValue(
    (context, initial) async => picks.removeAt(0),
  ),
];

void main() {
  testWidgets('rows exact', (tester) async {
    await pumpApp(
      tester,
      const SettingsScreen(),
      overrides: _overrides([], []),
    );
    await tester.pumpAndSettle();
    for (final r in _rows) {
      expect(find.text(r), findsOneWidget, reason: r);
    }
    expect(find.text('সার্ভারের সাথে সিঙ্ক'), findsNothing);
  });

  testWidgets('quiet-hours change persists and is pushed', (tester) async {
    final pushed = <(String, String)>[];
    await pumpApp(
      tester,
      const SettingsScreen(),
      overrides: _overrides(pushed, [
        const TimeOfDay(hour: 23, minute: 0),
        const TimeOfDay(hour: 7, minute: 0),
      ]),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('settings_quiet')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('quiet_start')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('quiet_end')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('quiet_save')));
    await tester.pumpAndSettle();

    expect(pushed, [('23:00', '07:00')]);
    expect(find.text('রাত ১১টা থেকে সকাল ৭টা চুপ'), findsOneWidget);
    final c = appContainer(tester);
    expect(c.read(preferencesProvider).quietStart, '23:00');
    final store = c.read(localStoreProvider);
    expect(
      await tester.runAsync(() => store.getMeta('pref_quiet_end')),
      '07:00',
    );
  });

  testWidgets('a rejected push rolls the quiet hours back', (tester) async {
    await pumpApp(
      tester,
      const SettingsScreen(),
      overrides: [
        preferencesPushProvider.overrideWithValue((_) async => true),
        quietHoursPushProvider.overrideWithValue((s, e) async => false),
        settingsTimePickerProvider.overrideWithValue(
          (context, initial) async => const TimeOfDay(hour: 20, minute: 0),
        ),
      ],
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('settings_quiet')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('quiet_start')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('quiet_save')));
    await tester.pumpAndSettle();
    expect(find.text('রাত ১০টা থেকে সকাল ৬টা চুপ'), findsOneWidget);
    expect(appContainer(tester).read(preferencesProvider).quietStart, '22:00');
  });

  testWidgets('simple mode switch and links', (tester) async {
    final visited = <String>[];
    final router = GoRouter(
      initialLocation: '/settings',
      routes: [
        GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
        for (final p in [
          '/accounts',
          '/tutorial',
          '/consent/policy',
          '/delete-account',
          '/profile',
        ])
          GoRoute(
            path: p,
            builder: (_, __) {
              visited.add(p);
              return Scaffold(body: Text(p));
            },
          ),
      ],
    );
    await pumpApp(
      tester,
      const SizedBox(),
      overrides: _overrides([], []),
      router: router,
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('settings_simple_switch')));
    await tester.pumpAndSettle();
    expect(appContainer(tester).read(preferencesProvider).simpleMode, isTrue);

    for (final (key, path) in [
      ('settings_catalog', '/accounts'),
      ('settings_tutorial', '/tutorial'),
      ('settings_privacy', '/consent/policy'),
      ('settings_delete', '/delete-account'),
      ('settings_profile', '/profile'),
    ]) {
      await tester.ensureVisible(find.byKey(Key(key)));
      await tester.tap(find.byKey(Key(key)));
      await tester.pumpAndSettle();
      expect(visited.last, path);
      router.pop();
      await tester.pumpAndSettle();
    }
  });
}
