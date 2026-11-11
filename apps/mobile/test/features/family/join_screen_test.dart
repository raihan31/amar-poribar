import 'package:amar_poribar/app/app.dart';
import 'package:amar_poribar/app/redirects.dart';
import 'package:amar_poribar/app/router.dart';
import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:amar_poribar/domain/models/api/me.dart';
import 'package:amar_poribar/features/auth/data/auth_repository.dart';
import 'package:amar_poribar/features/auth/data/fake_auth_repository.dart';
import 'package:amar_poribar/features/family/data/invite_repository.dart';
import 'package:amar_poribar/features/family/state/active_family.dart';
import 'package:amar_poribar/features/family/state/family_providers.dart';
import 'package:amar_poribar/features/family/ui/join_screen.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../../helpers/fake_auth.dart';
import '../../helpers/fake_voice_service.dart';
import '../../helpers/fakes.dart';
import '../../helpers/pump_app.dart';

const _joined = FamilyInfo('f-new', 'রহিম পরিবার', 'member');
const _signedIn = AuthState(loaded: true, token: 't', families: [_joined]);
const _noFamily = AuthState(loaded: true, token: 't');

GoRouter _router(String start) => GoRouter(
      initialLocation: start,
      routes: [
        GoRoute(
          path: Routes.join,
          builder: (_, s) => JoinScreen(token: s.pathParameters['token']!),
        ),
        GoRoute(
          path: Routes.login,
          builder: (_, __) => const Text('login-page'),
        ),
        GoRoute(
          path: Routes.home,
          builder: (_, __) => const Text('home-page'),
        ),
      ],
    );

String _loc(GoRouter r) => r.routerDelegate.currentConfiguration.uri.toString();

Future<GoRouter> _pumpJoin(
  WidgetTester t,
  String token, {
  AuthState auth = _noFamily,
  FakeAuthNotifier? notifier,
}) async {
  final router = _router('/join/$token');
  final fake = notifier ?? FakeAuthNotifier(auth, afterSignIn: _signedIn);
  await pumpApp(
    t,
    const SizedBox(),
    router: router,
    overrides: [
      authProvider.overrideWith((ref) => fake),
      inviteRepositoryProvider.overrideWithValue(
        FakeInviteRepository(joinedFamily: _joined),
      ),
      inviteClockProvider.overrideWithValue(() => DateTime.utc(2026, 11, 9, 4)),
    ],
  );
  await t.pumpAndSettle();
  return router;
}

void main() {
  testWidgets('preview shows Bangla digits and the member bullets', (t) async {
    await _pumpJoin(t, 'abc');
    expect(find.text('আব্বু আপনাকে ডেকেছেন'), findsOneWidget);
    expect(find.text('রহিম পরিবার'), findsOneWidget);
    expect(find.textContaining('৫ জন সদস্য · আপনি হবেন'), findsOneWidget);
    expect(find.text('আমন্ত্রণের মেয়াদ আছে আর ৬ দিন।'), findsOneWidget);
    expect(find.text('যোগ দিলে আপনি পারবেন'), findsOneWidget);
    expect(find.text('খরচ লিখতে ও দেখতে'), findsOneWidget);
    expect(find.text('পরিবারের সাথে কথা বলতে'), findsOneWidget);
    expect(find.text('ব্যক্তিগত খরচ শুধু নিজে দেখতে'), findsOneWidget);
    expect(find.text('যোগ দিন'), findsOneWidget);
    expect(find.text('এখন নয়'), findsOneWidget);
    final button = t.getSize(find.byKey(const Key('join_accept')));
    expect(button.height, 76);
  });

  testWidgets('a viewer invite swaps the first bullet', (t) async {
    await _pumpJoin(t, 'viewer');
    expect(find.text('পরিবারের হিসাব দেখতে (শুধু সারাংশ)'), findsOneWidget);
    expect(find.text('খরচ লিখতে ও দেখতে'), findsNothing);
  });

  testWidgets('accept goes to /home and sets the active family', (t) async {
    final router = await _pumpJoin(t, 'abc');
    await t.tap(find.byKey(const Key('join_accept')));
    await t.pumpAndSettle();
    expect(_loc(router), Routes.home);
    expect(appContainer(t).read(activeFamilyIdProvider), 'f-new');
    expect(appContainer(t).read(activeFamilyProvider)?.name, 'রহিম পরিবার');
  });

  testWidgets('an expired or used invite shows the F6 card', (t) async {
    await _pumpJoin(t, 'old');
    expect(find.text('আমন্ত্রণের মেয়াদ শেষ'), findsOneWidget);
    expect(find.text('আব্বুকে কম্পন দিন'), findsOneWidget);
    expect(find.byKey(const Key('join_accept')), findsNothing);
  });

  testWidgets('a used invite shows the same card', (t) async {
    await _pumpJoin(t, 'used');
    expect(find.text('আমন্ত্রণের মেয়াদ শেষ'), findsOneWidget);
  });

  testWidgets('an invite for another number says so', (t) async {
    await _pumpJoin(t, 'other');
    expect(find.text('এই আমন্ত্রণ অন্য নম্বরের জন্য।'), findsOneWidget);
  });

  testWidgets('"এখন নয়" goes home without joining', (t) async {
    final router = await _pumpJoin(t, 'abc');
    await t.tap(find.byKey(const Key('join_not_now')));
    await t.pumpAndSettle();
    expect(_loc(router), Routes.home);
  });

  group('full app', () {
    Future<(GoRouter, FakeAuthNotifier, LocalStore)> pumpFull(
      WidgetTester t,
      AuthState auth,
    ) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      final store =
          (await t.runAsync(() => LocalStore.open(AppDatabase.memory())))!;
      addTearDown(() => t.runAsync(store.db.close));
      final notifier = FakeAuthNotifier(auth, afterSignIn: _signedIn);
      await t.pumpWidget(
        ProviderScope(
          overrides: [
            ...defaultFakes(store: store, voice: FakeVoiceService()),
            authProvider.overrideWith((ref) => notifier),
            welcomeDoneProvider.overrideWith((ref) => true),
            authRepositoryProvider.overrideWithValue(FakeAuthRepository()),
          ],
          child: const AmarPoribarApp(),
        ),
      );
      await t.pumpAndSettle();
      final c =
          ProviderScope.containerOf(t.element(find.byType(AmarPoribarApp)));
      return (c.read(routerProvider), notifier, store);
    }

    testWidgets('signed out: stores the token, logs in, then resumes the join',
        (t) async {
      final (router, auth, store) =
          await pumpFull(t, const AuthState(loaded: true));
      router.go('/join/abc');
      await t.pumpAndSettle();
      expect(_loc(router), startsWith('/login'));
      expect(Uri.parse(_loc(router)).queryParameters['from'], '/join/abc');
      expect(await t.runAsync(() => store.getMeta('pending_invite')), 'abc');

      // Signed in with no family: the person joins instead of creating one.
      auth.set(_noFamily);
      await t.pumpAndSettle();
      expect(_loc(router), '/join/abc');
      expect(find.text('যোগ দিন'), findsOneWidget);
      await t.pumpWidget(const SizedBox());
    });

    testWidgets('deep link amarporibar://join/abc opens the join screen',
        (t) async {
      final (router, _, _) = await pumpFull(t, _signedIn);
      router.go('amarporibar://join/abc');
      await t.pumpAndSettle();
      expect(_loc(router), '/join/abc');
      expect(find.byType(JoinScreen), findsOneWidget);
      expect(find.text('আমন্ত্রণের মেয়াদ আছে আর ৬ দিন।'), findsOneWidget);
      await t.pumpWidget(const SizedBox());
    });
  });
}
