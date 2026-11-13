import 'package:amar_poribar/core/l10n/l10n_x.dart';
import 'package:amar_poribar/core/l10n/locale_controller.dart';
import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:amar_poribar/l10n/gen/app_localizations.dart';
import 'package:amar_poribar/presentation/providers/providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _Probe extends ConsumerWidget {
  const _Probe();

  @override
  Widget build(BuildContext context, WidgetRef ref) => MaterialApp(
        locale: ref.watch(localeProvider),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Builder(builder: (c) => Text(c.l10n.settings_title)),
      );
}

Widget app(LocalStore store) => ProviderScope(
      overrides: [localStoreProvider.overrideWithValue(store)],
      child: const _Probe(),
    );

void main() {
  testWidgets('defaults to Bangla, switches to English and persists',
      (tester) async {
    final store = await tester.runAsync(
      () => LocalStore.open(AppDatabase.memory()),
    );
    await tester.pumpWidget(app(store!));
    await tester.pumpAndSettle();
    expect(find.text('সেটিংস'), findsOneWidget);

    final container = ProviderScope.containerOf(
      tester.element(find.byType(_Probe)),
    );
    await tester.runAsync(
      () => container.read(localeProvider.notifier).setLocale(
            const Locale('en'),
          ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Settings'), findsOneWidget);

    // A fresh app on the same store (restart) comes up in English.
    await tester.pumpWidget(const SizedBox());
    await tester.pumpWidget(app(store));
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    await tester.pumpAndSettle();
    expect(find.text('Settings'), findsOneWidget);
  });

  test('ignores an unsupported stored value', () async {
    final store = await LocalStore.open(AppDatabase.memory());
    await store.setMeta('locale', 'fr');
    final c = LocaleController(store);
    await c.loaded;
    expect(c.state, const Locale('bn'));
  });
}
