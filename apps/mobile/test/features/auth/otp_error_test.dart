import 'dart:ui' as ui;

import 'package:amar_poribar/core/money/money_format.dart';
import 'package:amar_poribar/core/money/numeral_style_provider.dart';
import 'package:amar_poribar/core/theme/ui_scale.dart';
import 'package:amar_poribar/features/auth/data/auth_repository.dart';
import 'package:amar_poribar/features/auth/data/fake_auth_repository.dart';
import 'package:amar_poribar/features/auth/domain/otp_failure.dart';
import 'package:amar_poribar/features/auth/state/login_controller.dart';
import 'package:amar_poribar/features/auth/ui/login_screen.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fake_voice_service.dart';
import '../../helpers/fakes.dart';
import '../../helpers/pump_app.dart';

Future<void> _toCodeStep(
  WidgetTester t,
  FakeAuthRepository repo,
  FakeClock clock, {
  NumeralStyle? numerals,
  bool simple = false,
}) async {
  await pumpApp(
    t,
    const LoginScreen(),
    overrides: [
      authRepositoryProvider.overrideWithValue(repo),
      loginClockProvider.overrideWithValue(clock.now),
      loginSignedInProvider.overrideWithValue(() async {}),
    ],
  );
  final c = appContainer(t);
  if (numerals != null) c.read(numeralStyleProvider.notifier).state = numerals;
  if (simple) c.read(uiScaleProvider.notifier).state = UiScale.simple;
  await t.enterText(find.bySemanticsLabel('মোবাইল নম্বর'), '01712345678');
  await t.tap(find.text('ঢুকুন'));
  await t.pumpAndSettle();
}

Future<void> _wrongCode(WidgetTester t) async {
  await t.enterText(find.bySemanticsLabel('৬ সংখ্যার কোড'), '479103');
  await t.pump();
  await t.tap(find.text('ঢুকুন'));
  await t.pumpAndSettle();
}

Future<void> _end(WidgetTester t) => t.pumpWidget(const SizedBox());

bool _submitEnabled(WidgetTester t) {
  final data =
      t.getSemantics(find.bySemanticsLabel('ঢুকুন')).getSemanticsData();
  return data.flagsCollection.isEnabled == ui.Tristate.isTrue;
}

void main() {
  testWidgets('invalid(4) shows Bangla digits when numeral style is Bangla',
      (t) async {
    final h = t.ensureSemantics();
    final repo = FakeAuthRepository(
      verifyErrors: [const OtpError(Invalid(4))],
    );
    await _toCodeStep(t, repo, FakeClock(), numerals: NumeralStyle.bangla);
    await _wrongCode(t);
    expect(find.text('কোডটি মেলেনি'), findsOneWidget);
    expect(
      find.text('আবার দেখে লিখুন। আর ৪ বার চেষ্টা করতে পারবেন।'),
      findsOneWidget,
    );
    expect(find.text('নতুন কোড পাঠান'), findsOneWidget);
    expect(find.text('নম্বর ভুল? বদলান'), findsOneWidget);
    expect(
        find.textContaining(
          'কোড না এলে:',
          findRichText: true,
        ),
        findsOneWidget,
    );
    expect(
      find.text(
        'এক ঘণ্টায় সর্বোচ্চ ৫ বার কোড চাওয়া যায়। এ নম্বরে ১ বার চাওয়া হয়েছে।',
      ),
      findsOneWidget,
    );
    h.dispose();
    await _end(t);
  });

  testWidgets('invalid(4) shows Latin digits when numeral style is Latin',
      (t) async {
    final repo = FakeAuthRepository(
      verifyErrors: [const OtpError(Invalid(4))],
    );
    await _toCodeStep(t, repo, FakeClock(), numerals: NumeralStyle.latin);
    await _wrongCode(t);
    expect(
      find.text('আবার দেখে লিখুন। আর 4 বার চেষ্টা করতে পারবেন।'),
      findsOneWidget,
    );
    await _end(t);
  });

  testWidgets('no attempts left clears the code and disables submit',
      (t) async {
    final h = t.ensureSemantics();
    final repo = FakeAuthRepository(
      verifyErrors: [const OtpError(Invalid(0))],
    );
    await _toCodeStep(t, repo, FakeClock());
    await _wrongCode(t);
    expect(appContainer(t).read(loginControllerProvider).code, '');
    expect(_submitEnabled(t), isFalse);
    expect(find.text('নতুন কোড পাঠান'), findsOneWidget);
    h.dispose();
    await _end(t);
  });

  testWidgets('expired shows the new-code button only', (t) async {
    final repo = FakeAuthRepository(
      verifyErrors: [const OtpError(Expired())],
    );
    await _toCodeStep(t, repo, FakeClock());
    await _wrongCode(t);
    expect(find.text('কোডের সময় শেষ'), findsOneWidget);
    expect(find.text('নতুন কোড নিন।'), findsOneWidget);
    expect(find.text('নতুন কোড পাঠান'), findsOneWidget);
    expect(find.text('নম্বর ভুল? বদলান'), findsNothing);
    expect(
        find.textContaining(
          'কোড না এলে:',
          findRichText: true,
        ),
        findsNothing,
    );
    await _end(t);
  });

  testWidgets('new code button requests a fresh code and clears the panel',
      (t) async {
    final repo = FakeAuthRepository(
      verifyErrors: [const OtpError(Expired())],
    );
    await _toCodeStep(t, repo, FakeClock());
    await _wrongCode(t);
    await t.tap(find.text('নতুন কোড পাঠান'));
    await t.pumpAndSettle();
    expect(repo.requested.length, 2);
    expect(find.text('কোডের সময় শেষ'), findsNothing);
    await _end(t);
  });

  testWidgets('rate-limited disables submit and shows a live countdown',
      (t) async {
    final h = t.ensureSemantics();
    final clock = FakeClock();
    final repo = FakeAuthRepository(
      verifyErrors: [const OtpError(RateLimited(Duration(seconds: 90)))],
    );
    await _toCodeStep(t, repo, clock);
    await _wrongCode(t);
    expect(
      find.text('অনেকবার চেষ্টা হয়েছে। ১:৩০ পরে আবার চেষ্টা করুন।'),
      findsOneWidget,
    );
    expect(_submitEnabled(t), isFalse);
    clock.advance(const Duration(seconds: 10));
    await t.pump(const Duration(seconds: 10));
    expect(
      find.text('অনেকবার চেষ্টা হয়েছে। ১:২০ পরে আবার চেষ্টা করুন।'),
      findsOneWidget,
    );
    // Resend is disabled while the lockout runs.
    await t.tap(find.text('নতুন কোড পাঠান'));
    await t.pump();
    expect(repo.requested.length, 1);
    clock.advance(const Duration(seconds: 80));
    await t.pump(const Duration(seconds: 80));
    expect(find.textContaining('অনেকবার চেষ্টা হয়েছে'), findsNothing);
    h.dispose();
    await _end(t);
  });

  testWidgets('server and network failures have their own text', (t) async {
    final h = t.ensureSemantics();
    final repo = FakeAuthRepository(
      verifyErrors: [const OtpError(Server()), const OtpError(Network())],
    );
    await _toCodeStep(t, repo, FakeClock());
    await _wrongCode(t);
    expect(
      find.text('এখন সংযোগ হচ্ছে না। একটু পরে আবার চেষ্টা করুন।'),
      findsOneWidget,
    );
    // A failed connection never blocks another try.
    expect(_submitEnabled(t), isTrue);
    await t.tap(find.text('ঢুকুন'));
    await t.pumpAndSettle();
    expect(find.textContaining('এখন সংযোগ হচ্ছে না'), findsNothing);
    expect(find.textContaining('ইন্টারনেট'), findsOneWidget);
    h.dispose();
    await _end(t);
  });

  testWidgets('changing the number returns to the phone step, number kept',
      (t) async {
    final repo = FakeAuthRepository(
      verifyErrors: [const OtpError(Invalid(4))],
    );
    await _toCodeStep(t, repo, FakeClock());
    await _wrongCode(t);
    await t.tap(find.text('নম্বর ভুল? বদলান'));
    await t.pumpAndSettle();
    final s = appContainer(t).read(loginControllerProvider);
    expect(s.phase, LoginPhase.phone);
    expect(s.phone, '+8801712345678');
    expect(s.error, isNull);
    expect(find.text('কোডটি মেলেনি'), findsNothing);
    await _end(t);
  });

  testWidgets('Simple mode speaks the error title and body', (t) async {
    final repo = FakeAuthRepository(
      verifyErrors: [const OtpError(Invalid(4))],
    );
    await _toCodeStep(t, repo, FakeClock(), simple: true);
    await _wrongCode(t);
    final voice =
        appContainer(t).read(voiceServiceProvider) as FakeVoiceService;
    expect(voice.spoken.single, contains('কোডটি মেলেনি'));
    expect(voice.spoken.single, contains('আর ৪ বার'));
    await _end(t);
  });
}
