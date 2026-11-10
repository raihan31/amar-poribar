import 'package:amar_poribar/app/redirects.dart';
import 'package:amar_poribar/core/money/money_format.dart';
import 'package:amar_poribar/core/money/numeral_style_provider.dart';
import 'package:amar_poribar/features/auth/data/auth_repository.dart';
import 'package:amar_poribar/features/auth/data/fake_auth_repository.dart';
import 'package:amar_poribar/features/auth/state/login_controller.dart';
import 'package:amar_poribar/features/auth/ui/login_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../../a11y/a11y_helpers.dart';
import '../../helpers/fakes.dart';
import '../../helpers/pump_app.dart';

GoRouter _router() => GoRouter(
      initialLocation: Routes.login,
      routes: [
        GoRoute(path: Routes.login, builder: (_, __) => const LoginScreen()),
        GoRoute(
          path: Routes.loginCode,
          builder: (_, __) => const LoginScreen(phase: LoginPhase.code),
        ),
        GoRoute(
          path: Routes.home,
          builder: (_, __) => const Scaffold(body: Text('HOME')),
        ),
      ],
    );

Future<void> _enter(
  WidgetTester t,
  FakeAuthRepository repo,
  FakeClock clock, {
  GoRouter? router,
}) async {
  await pumpApp(
    t,
    const LoginScreen(),
    router: router,
    overrides: [
      authRepositoryProvider.overrideWithValue(repo),
      loginClockProvider.overrideWithValue(clock.now),
      loginSignedInProvider.overrideWithValue(() async {}),
    ],
  );
}

Future<void> _end(WidgetTester t) async {
  await t.pumpWidget(const SizedBox());
}

void main() {
  testWidgets('phone step shows the exact Bangla labels', (t) async {
    await _enter(t, FakeAuthRepository(), FakeClock());
    expect(find.text('আমার পরিবার'), findsOneWidget);
    expect(find.text('পরিবারের সব হিসাব, এক জায়গায়'), findsOneWidget);
    expect(find.text('আপনার মোবাইল নম্বর দিন'), findsOneWidget);
    expect(find.text('আমরা একটি ৬ সংখ্যার কোড এসএমএসে পাঠাব।'), findsOneWidget);
    expect(find.text('+৮৮'), findsOneWidget);
    expect(find.text('ঢুকুন'), findsOneWidget);
    expect(find.text('সাহায্য লাগলে বাড়ির কাউকে ফোন দিন।'), findsOneWidget);
    await _end(t);
  });

  for (final entry in {
    'Latin': '01712345678',
    'Bangla': '০১৭১২৩৪৫৬৭৮',
  }.entries) {
    testWidgets('${entry.key} digits are accepted', (t) async {
      final repo = FakeAuthRepository();
      await _enter(t, repo, FakeClock());
      await t.enterText(find.bySemanticsLabel('মোবাইল নম্বর'), entry.value);
      await t.tap(find.text('ঢুকুন'));
      await t.pumpAndSettle();
      expect(repo.requested, ['+8801712345678']);
      expect(find.text('কোডটি লিখুন'), findsOneWidget);
      await _end(t);
    });
  }

  testWidgets('invalid number shows the message and makes no API call',
      (t) async {
    final repo = FakeAuthRepository();
    await _enter(t, repo, FakeClock());
    await t.enterText(find.bySemanticsLabel('মোবাইল নম্বর'), '0123');
    await t.tap(find.text('ঢুকুন'));
    await t.pumpAndSettle();
    expect(
      find.text('নম্বরটি ঠিক নয়। ০১ দিয়ে শুরু করে ১১ সংখ্যা লিখুন।'),
      findsOneWidget,
    );
    expect(repo.requested, isEmpty);
    await _end(t);
  });

  testWidgets('valid number goes to the code step; resend timer counts down',
      (t) async {
    final clock = FakeClock();
    final repo = FakeAuthRepository(resendAfterSeconds: 42);
    await _enter(t, repo, clock);
    await t.enterText(find.bySemanticsLabel('মোবাইল নম্বর'), '01712345678');
    await t.tap(find.text('ঢুকুন'));
    await t.pumpAndSettle();
    expect(find.text('কোড আসেনি? '), findsOneWidget);
    expect(find.text('আবার পাঠান (০:৪২)'), findsOneWidget);
    clock.advance(const Duration(seconds: 2));
    await t.pump(const Duration(seconds: 2));
    expect(find.text('আবার পাঠান (০:৪০)'), findsOneWidget);
    clock.advance(const Duration(seconds: 40));
    await t.pump(const Duration(seconds: 40));
    expect(find.text('আবার পাঠান'), findsOneWidget);
    await _end(t);
  });

  testWidgets('countdown follows the numeral setting', (t) async {
    await _enter(t, FakeAuthRepository(), FakeClock());
    appContainer(t).read(numeralStyleProvider.notifier).state =
        NumeralStyle.latin;
    await t.enterText(find.bySemanticsLabel('মোবাইল নম্বর'), '01712345678');
    await t.tap(find.text('ঢুকুন'));
    await t.pumpAndSettle();
    expect(find.text('আবার পাঠান (0:42)'), findsOneWidget);
    await _end(t);
  });

  testWidgets('code 123456 signs in and navigates to /home', (t) async {
    final repo = FakeAuthRepository();
    final router = _router();
    await _enter(t, repo, FakeClock(), router: router);
    await t.enterText(find.bySemanticsLabel('মোবাইল নম্বর'), '01712345678');
    await t.tap(find.text('ঢুকুন'));
    await t.pumpAndSettle();
    expect(router.state.uri.path, Routes.loginCode);
    await t.enterText(find.bySemanticsLabel('৬ সংখ্যার কোড'), '১২৩৪৫৬');
    await t.pump();
    await t.tap(find.text('ঢুকুন'));
    await t.pumpAndSettle();
    expect(repo.verified, ['123456']);
    expect(router.state.uri.path, Routes.home);
    expect(find.text('HOME'), findsOneWidget);
    await _end(t);
  });

  testWidgets('semantics: labels and sizes', (t) async {
    final repo = FakeAuthRepository();
    await _enter(t, repo, FakeClock());
    final h = t.ensureSemantics();
    expect(find.bySemanticsLabel('মোবাইল নম্বর'), findsOneWidget);
    expect(find.bySemanticsLabel('ঢুকুন'), findsOneWidget);
    final submit = t.getSize(find.bySemanticsLabel('ঢুকুন')).height;
    expect(submit, greaterThanOrEqualTo(72));
    await expectAllTappablesLabelled(t);
    await t.enterText(find.bySemanticsLabel('মোবাইল নম্বর'), '01712345678');
    await t.tap(find.text('ঢুকুন'));
    await t.pumpAndSettle();
    expect(find.bySemanticsLabel('৬ সংখ্যার কোড'), findsOneWidget);
    await expectAllTappablesLabelled(t, primaryMin: const Size(72, 72));
    h.dispose();
    await _end(t);
  });
}
