import 'package:amar_poribar/app/app.dart';
import 'package:amar_poribar/app/redirects.dart';
import 'package:amar_poribar/app/router.dart';
import 'package:amar_poribar/data/api/api_client.dart';
import 'package:amar_poribar/data/auth/session_manager.dart';
import 'package:amar_poribar/data/auth/token_store.dart';
import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:amar_poribar/features/onboarding/data/fake_onboarding_repository.dart';
import 'package:amar_poribar/features/onboarding/data/onboarding_repository.dart';
import 'package:amar_poribar/features/onboarding/state/consent_check.dart';
import 'package:amar_poribar/features/onboarding/ui/consent_screen.dart';
import 'package:amar_poribar/features/onboarding/ui/policy_screen.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:amar_poribar/presentation/providers/providers.dart';
import 'package:amar_poribar/ui/big_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import '../../helpers/fake_voice_service.dart';
import '../../helpers/pump_app.dart';

GoRouter _router() => GoRouter(
      initialLocation: Routes.consent,
      routes: [
        GoRoute(
          path: Routes.consent,
          builder: (_, __) => const ConsentScreen(),
        ),
        GoRoute(
          path: Routes.consentPolicy,
          builder: (_, __) => const PolicyScreen(),
        ),
        GoRoute(
          path: Routes.home,
          builder: (_, __) => const Scaffold(body: Text('HOME')),
        ),
        GoRoute(
          path: Routes.tutorial,
          builder: (_, __) => const Scaffold(body: Text('TUTORIAL')),
        ),
      ],
    );

Future<void> _pump(
  WidgetTester t,
  FakeOnboardingRepository repo, {
  List<Override> extra = const [],
}) async {
  await pumpApp(
    t,
    const ConsentScreen(),
    router: _router(),
    overrides: [
      onboardingRepositoryProvider.overrideWithValue(repo),
      onboardingFinishProvider.overrideWithValue(() async {}),
      ...extra,
    ],
  );
  await t.pumpAndSettle();
}

bool _enabled(WidgetTester t) =>
    t.widget<BigButton>(find.byKey(const Key('consent_submit'))).onPressed !=
    null;

class _Api extends Mock implements ApiClient {}

class _NoTokens implements TokenStore {
  @override
  Future<Tokens?> read() async => null;
  @override
  Future<void> write(Tokens t) async {}
  @override
  Future<void> clear() async {}
}

class _FakeAuth extends AuthNotifier {
  _FakeAuth(AuthState s)
      : super(
          _Api(),
          SessionManager(
            store: _NoTokens(),
            refresh: (_) async => throw UnimplementedError(),
          ),
        ) {
    state = s;
  }
}

void main() {
  testWidgets('shows the exact Bangla copy', (t) async {
    await _pump(t, FakeOnboardingRepository());
    for (final s in [
      'আপনার পরিবার তৈরি করুন',
      'ধাপ ১ / ২',
      'পরিবারের নাম',
      'রহিম পরিবার',
      'টাকার ধরন',
      '৳ বাংলাদেশি টাকা (BDT)',
      'আপনার তথ্য কীভাবে ব্যবহার হবে',
      'শুধু আপনার পরিবারের সদস্যরা হিসাব দেখবে।',
      'কথা আপনার ফোনেই লেখা হয়। রেকর্ড সার্ভারে যায় না।',
      'এআই-এর জন্য ফোন নম্বর ও অ্যাকাউন্ট নম্বর পাঠানো হয় না। '
          'যেকোনো সময় তথ্য মুছে দিতে পারবেন।',
      'আমি রাজি আছি',
      'গোপনীয়তা নীতি',
      'পরিবার তৈরি করুন',
    ]) {
      expect(find.text(s), findsOneWidget, reason: s);
    }
    expect(
      t.getSize(find.byKey(const Key('consent_checkbox'))).height,
      greaterThanOrEqualTo(40),
    );
  });

  testWidgets('button is disabled until checkbox and a name of 2+ characters',
      (t) async {
    final repo = FakeOnboardingRepository();
    await _pump(t, repo);
    expect(find.byKey(const Key('consent_submit')), findsOneWidget);
    expect(_enabled(t), isFalse);

    await t.enterText(find.byKey(const Key('consent_name')), 'ক');
    await t.pump();
    await t.tap(find.byKey(const Key('consent_checkbox')));
    await t.pump();
    expect(_enabled(t), isFalse, reason: 'one character is too short');

    await t.enterText(find.byKey(const Key('consent_name')), 'রহিম পরিবার');
    await t.pump();
    expect(_enabled(t), isTrue);

    await t.tap(find.byKey(const Key('consent_checkbox')));
    await t.pump();
    expect(_enabled(t), isFalse, reason: 'unchecked again');

    // Greyed, not hidden; tapping does nothing.
    await t.tap(find.byKey(const Key('consent_submit')));
    await t.pump();
    expect(repo.consents, isEmpty);
  });

  testWidgets('consent is called once when the family fails and is retried',
      (t) async {
    final repo = FakeOnboardingRepository(failFamilyTimes: 1);
    await _pump(t, repo);
    await t.enterText(find.byKey(const Key('consent_name')), 'রহিম পরিবার');
    await t.tap(find.byKey(const Key('consent_checkbox')));
    await t.pump();

    await t.tap(find.byKey(const Key('consent_submit')));
    await t.pumpAndSettle();
    expect(repo.consents, [('2026-11', 'bn')]);
    expect(repo.createdFamilies, isEmpty);
    expect(
      find.text('কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।'),
      findsOneWidget,
    );

    await t.tap(find.byKey(const Key('consent_submit')));
    await t.pumpAndSettle();
    expect(repo.consents, hasLength(1), reason: 'consent is not repeated');
    expect(repo.createdFamilies, ['রহিম পরিবার']);
    expect(find.text('ধাপ ২ / ২'), findsOneWidget);
    expect(find.text('শুনে নিই'), findsOneWidget);
    expect(find.text('এখন নয়'), findsOneWidget);

    final c = appContainer(t);
    expect(c.read(consentCurrentProvider), isTrue);
    expect(
      await c.read(localStoreProvider).getMeta(consentVersionKey),
      '2026-11',
    );
  });

  testWidgets('step 2: "শুনে নিই" opens the tutorial, "এখন নয়" opens home',
      (t) async {
    for (final listen in [true, false]) {
      final repo = FakeOnboardingRepository();
      await _pump(t, repo);
      await t.enterText(find.byKey(const Key('consent_name')), 'আমরা');
      await t.tap(find.byKey(const Key('consent_checkbox')));
      await t.pump();
      await t.tap(find.byKey(const Key('consent_submit')));
      await t.pumpAndSettle();
      await t.tap(
        find.byKey(Key(listen ? 'consent_listen' : 'consent_not_now')),
      );
      await t.pumpAndSettle();
      expect(find.text(listen ? 'TUTORIAL' : 'HOME'), findsOneWidget);
      await t.pumpWidget(const SizedBox());
    }
  });

  testWidgets('the policy screen shows the text and reads it aloud', (t) async {
    final repo = FakeOnboardingRepository(body: 'নীতির লেখা');
    await _pump(t, repo);
    await t.tap(find.byKey(const Key('consent_policy_link')));
    await t.pumpAndSettle();
    expect(find.text('নীতির লেখা'), findsOneWidget);
    await t.tap(find.text('শুনুন'));
    await t.pump();
    final voice = appContainer(t).read(voiceServiceProvider);
    expect((voice as FakeVoiceService).spoken, contains('নীতির লেখা'));
    await t.pumpAndSettle();
  });

  group('version mismatch', () {
    testWidgets(
        'a changed policy version sends a signed-in user back to /consent',
        (t) async {
      final store = await LocalStore.open(AppDatabase.memory());
      await store.setMeta(consentVersionKey, '2026-01');
      final auth = _FakeAuth(
        const AuthState(
          loaded: true,
          token: 't',
          families: [FamilyInfo('f1', 'রহিম পরিবার', 'owner')],
        ),
      );
      final container = ProviderContainer(
        overrides: [
          localStoreProvider.overrideWithValue(store),
          authProvider.overrideWith((ref) => auth),
          tokenStoreProvider.overrideWithValue(_NoTokens()),
          consentCurrentProvider.overrideWith((ref) => true),
          onboardingRepositoryProvider
              .overrideWithValue(FakeOnboardingRepository(version: '2026-11')),
          onboardingFinishProvider.overrideWithValue(() async {}),
          placeholderBuilderProvider.overrideWithValue(
            (n) => Scaffold(body: Text('PLACEHOLDER $n')),
          ),
        ],
      );
      addTearDown(container.dispose);
      await t.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const AmarPoribarApp(),
        ),
      );
      await t.pumpAndSettle();
      final router = container.read(routerProvider);
      String loc() => router.routerDelegate.currentConfiguration.uri.toString();
      expect(loc(), '/home');

      await checkConsent(container);
      await t.pumpAndSettle();
      expect(loc(), '/consent');
      // A user who already has a family only accepts; no family fields.
      expect(find.byKey(const Key('consent_name')), findsNothing);

      router.go('/home');
      await t.pumpAndSettle();
      expect(loc(), '/consent', reason: 'home is closed until consent');

      // Accepting the new version opens the app again.
      await t.tap(find.byKey(const Key('consent_checkbox')));
      await t.pump();
      await t.tap(find.byKey(const Key('consent_submit')));
      await t.pumpAndSettle();
      expect(container.read(consentCurrentProvider), isTrue);
      expect(loc(), '/home');
    });

    testWidgets('the same version keeps the user where they are', (t) async {
      final store = await LocalStore.open(AppDatabase.memory());
      await store.setMeta(consentVersionKey, '2026-11');
      final container = ProviderContainer(
        overrides: [
          localStoreProvider.overrideWithValue(store),
          onboardingRepositoryProvider
              .overrideWithValue(FakeOnboardingRepository(version: '2026-11')),
        ],
      );
      addTearDown(container.dispose);
      await checkConsent(container);
      expect(container.read(consentCurrentProvider), isTrue);
    });
  });
}
