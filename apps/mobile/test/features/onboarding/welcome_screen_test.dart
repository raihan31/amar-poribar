import 'package:amar_poribar/app/redirects.dart';
import 'package:amar_poribar/core/theme/ui_scale.dart';
import 'package:amar_poribar/features/onboarding/ui/welcome_screen.dart';
import 'package:amar_poribar/features/settings/state/preferences_controller.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:amar_poribar/presentation/providers/providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../../helpers/fake_voice_service.dart';
import '../../helpers/pump_app.dart';

GoRouter _router() => GoRouter(
      initialLocation: Routes.welcome,
      routes: [
        GoRoute(
          path: Routes.welcome,
          builder: (_, __) => const WelcomeScreen(),
        ),
        GoRoute(
          path: Routes.login,
          builder: (_, __) => const Scaffold(body: Text('LOGIN')),
        ),
      ],
    );

double _continueHeight(WidgetTester t) =>
    t.getSize(find.byKey(const Key('welcome_continue'))).height;

void main() {
  testWidgets('shows the exact Bangla copy from the board', (t) async {
    await pumpApp(t, const WelcomeScreen());
    expect(find.text('স্বাগতম'), findsOneWidget);
    expect(find.text('ভাষা · Language'), findsOneWidget);
    expect(find.text('সংখ্যা · Numbers'), findsOneWidget);
    expect(find.text('বাংলা'), findsOneWidget);
    expect(find.text('English'), findsOneWidget);
    expect(find.text('১২৩'), findsOneWidget);
    expect(find.text('123'), findsOneWidget);
    expect(find.text('সহজ মোড'), findsOneWidget);
    expect(
      find.text('বড় লেখা, ছবি আর কথা। সব কিছু শুনিয়ে দেবে।'),
      findsOneWidget,
    );
    expect(find.text('পরে সেটিং থেকে বদলাতে পারবেন।'), findsOneWidget);
    expect(find.text('এগিয়ে চলুন'), findsOneWidget);
  });

  testWidgets('choosing English changes labels to English and persists',
      (t) async {
    await pumpApp(t, const WelcomeScreen());
    await t.tap(find.text('English'));
    await t.pumpAndSettle();
    expect(find.text('Welcome'), findsOneWidget);
    expect(find.text('Continue'), findsOneWidget);
    expect(find.text('এগিয়ে চলুন'), findsNothing);
    final store = appContainer(t).read(localStoreProvider);
    await t.runAsync(() async {
      expect(await store.getMeta('pref_locale'), 'en');
    });
    expect(
      appContainer(t).read(preferencesProvider).locale,
      const Locale('en'),
    );
  });

  testWidgets('numeral chips change the amount sample', (t) async {
    await pumpApp(t, const WelcomeScreen());
    expect(find.text('৳ ১,২৫,০০০'), findsOneWidget);
    await t.tap(find.text('123'));
    await t.pumpAndSettle();
    expect(find.text('৳ 1,25,000'), findsOneWidget);
    final store = appContainer(t).read(localStoreProvider);
    await t.runAsync(() async {
      expect(await store.getMeta('pref_numerals'), 'latin');
    });
    await t.tap(find.text('১২৩'));
    await t.pumpAndSettle();
    expect(find.text('৳ ১,২৫,০০০'), findsOneWidget);
  });

  testWidgets('simple toggle grows the continue button 56 to 72', (t) async {
    await pumpApp(t, const WelcomeScreen());
    expect(_continueHeight(t), 56);
    await t.tap(find.byKey(const Key('welcome_simple_switch')));
    await t.pumpAndSettle();
    expect(appContainer(t).read(uiScaleProvider), UiScale.simple);
    expect(_continueHeight(t), 72);
    final store = appContainer(t).read(localStoreProvider);
    await t.runAsync(() async {
      expect(await store.getMeta('pref_simple'), '1');
    });
    await t.tap(find.byKey(const Key('welcome_simple_switch')));
    await t.pumpAndSettle();
    expect(_continueHeight(t), 56);
  });

  testWidgets('simple mode speaks the headline once', (t) async {
    await pumpApp(t, const WelcomeScreen());
    final voice = appContainer(t).read(voiceServiceProvider);
    for (var i = 0; i < 3; i++) {
      await t.tap(find.byKey(const Key('welcome_simple_switch')));
      await t.pumpAndSettle();
    }
    expect((voice as FakeVoiceService).spoken, ['স্বাগতম']);
  });

  testWidgets('continue saves welcome_done and goes to login', (t) async {
    await pumpApp(t, const WelcomeScreen(), router: _router());
    await t.tap(find.byKey(const Key('welcome_continue')));
    await t.pumpAndSettle();
    expect(find.text('LOGIN'), findsOneWidget);
    final c = appContainer(t);
    expect(c.read(welcomeDoneProvider), isTrue);
    await t.runAsync(() async {
      expect(await c.read(localStoreProvider).getMeta('welcome_done'), '1');
    });
  });

  testWidgets('language chips are at least 48 dp tall', (t) async {
    await pumpApp(t, const WelcomeScreen());
    expect(
      t.getSize(find.byKey(const Key('welcome_lang_en'))).height,
      greaterThanOrEqualTo(48),
    );
  });
}
