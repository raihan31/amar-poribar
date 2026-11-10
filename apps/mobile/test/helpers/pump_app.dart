/// Test harness shared by every widget test (T-MOB-13).
///
/// Usage:
/// ```dart
/// testWidgets('shows the title', (t) async {
///   await pumpApp(t, const MyScreen(), overrides: [myRepoProvider.overrideWithValue(fake)]);
///   expect(find.text('...'), findsOneWidget);
///   final voice = appContainer(t).read(voiceServiceProvider); // the FakeVoiceService in use
/// });
/// ```
/// `pumpApp` wraps the screen in a `ProviderScope` with [defaultFakes] (in-memory store, memory
/// token store, fake voice) plus your overrides, then a `MaterialApp` with the real themes, the
/// generated localisation delegates and a Bangla locale. The view is 390x844 at pixel ratio 1.
/// Pass `router:` to test navigation; then `screen` is ignored.
library;

import 'package:amar_poribar/core/theme/app_theme.dart';
import 'package:amar_poribar/core/theme/ui_scale.dart';
import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:amar_poribar/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'fake_voice_service.dart';
import 'fakes.dart';

Future<void> pumpApp(
  WidgetTester t,
  Widget screen, {
  List<Override> overrides = const [],
  Locale locale = const Locale('bn'),
  UiScale scale = UiScale.normal,
  bool dark = false,
  Size size = const Size(390, 844),
  GoRouter? router,
}) async {
  t.view.physicalSize = size;
  t.view.devicePixelRatio = 1;
  addTearDown(t.view.reset);

  final store = await LocalStore.open(AppDatabase.memory());
  addTearDown(() => store.db.close());
  final voice = FakeVoiceService();

  final light = lightTheme(scale);
  final darkT = darkTheme(scale);
  final mode = dark ? ThemeMode.dark : ThemeMode.light;
  const delegates = AppLocalizations.localizationsDelegates;
  const supported = AppLocalizations.supportedLocales;

  await t.pumpWidget(
    ProviderScope(
      overrides: [
        ...defaultFakes(store: store, voice: voice),
        ...overrides,
      ],
      child: router == null
          ? MaterialApp(
              localizationsDelegates: delegates,
              supportedLocales: supported,
              locale: locale,
              theme: light,
              darkTheme: darkT,
              themeMode: mode,
              home: screen,
            )
          : MaterialApp.router(
              localizationsDelegates: delegates,
              supportedLocales: supported,
              locale: locale,
              theme: light,
              darkTheme: darkT,
              themeMode: mode,
              routerConfig: router,
            ),
    ),
  );
}

/// The provider container behind the pumped app, for reading providers in a test.
ProviderContainer appContainer(WidgetTester t) =>
    ProviderScope.containerOf(t.element(find.byType(Navigator).first));
