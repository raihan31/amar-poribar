import 'dart:async';

import 'package:amar_poribar/app/app.dart';
import 'package:amar_poribar/app/redirects.dart';
import 'package:amar_poribar/app/router.dart';
import 'package:amar_poribar/data/api/api_client.dart';
import 'package:amar_poribar/data/auth/session_manager.dart';
import 'package:amar_poribar/data/auth/token_store.dart';
import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:amar_poribar/presentation/providers/providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

class _Api extends Mock implements ApiClient {}

class _MemoryTokens implements TokenStore {
  @override
  Future<Tokens?> read() async => null;
  @override
  Future<void> write(Tokens t) async {}
  @override
  Future<void> clear() async {}
}

/// An [AuthNotifier] whose state the test sets directly.
class FakeAuth extends AuthNotifier {
  FakeAuth()
      : super(
          _Api(),
          SessionManager(
            store: _MemoryTokens(),
            refresh: (_) async => throw UnimplementedError(),
          ),
        );

  void set(AuthState s) => state = s;
}

const _family = FamilyInfo('f1', 'রহিম পরিবার', 'owner');
const _signedOut = AuthState(loaded: true);
const _signedIn = AuthState(loaded: true, token: 't', family: _family);

/// Scrollable stand-in so tab scroll state can be observed.
Widget _scrolling(String name) => Scaffold(
      body: ListView(
        children: [
          for (var i = 0; i < 100; i++)
            SizedBox(height: 60, child: Text('$name $i')),
        ],
      ),
    );

Future<(GoRouter, FakeAuth, ProviderContainer)> _pump(
  WidgetTester tester, {
  AuthState auth = _signedOut,
  bool welcomeDone = false,
}) async {
  final store = await LocalStore.open(AppDatabase.memory());
  final fake = FakeAuth()..set(auth);
  final container = ProviderContainer(
    overrides: [
      localStoreProvider.overrideWithValue(store),
      authProvider.overrideWith((ref) => fake),
      welcomeDoneProvider.overrideWith((ref) => welcomeDone),
      placeholderBuilderProvider.overrideWithValue(_scrolling),
    ],
  );
  addTearDown(container.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: const AmarPoribarApp(),
    ),
  );
  await tester.pumpAndSettle();
  return (container.read(routerProvider), fake, container);
}

String _loc(GoRouter r) => r.routerDelegate.currentConfiguration.uri.toString();

void main() {
  testWidgets('signed out goes to /welcome, or /login once welcome is done',
      (tester) async {
    final (router, _, _) = await _pump(tester);
    expect(_loc(router), '/welcome');

    final (router2, _, _) = await _pump(tester, welcomeDone: true);
    expect(_loc(router2), '/login');
  });

  testWidgets('after sign-in with a family it lands on /home', (tester) async {
    final (router, auth, _) = await _pump(tester, welcomeDone: true);
    auth.set(_signedIn);
    router.go('/login');
    await tester.pumpAndSettle();
    expect(_loc(router), '/home');
  });

  testWidgets('signed in without a family goes to /consent', (tester) async {
    final (router, _, _) = await _pump(
      tester,
      auth: const AuthState(loaded: true, token: 't'),
    );
    expect(_loc(router), '/consent');
  });

  testWidgets(
      'amarporibar://join/abc while signed out lands on /join/abc, '
      'then resumes after login', (tester) async {
    final (router, auth, _) = await _pump(tester, welcomeDone: true);
    router.go('amarporibar://join/abc');
    await tester.pumpAndSettle();
    expect(_loc(router), '/join/abc');

    // The join screen sends a signed-out person to log in and remembers where they were.
    router.go('/login?from=${Uri.encodeQueryComponent('/join/abc')}');
    await tester.pumpAndSettle();
    expect(_loc(router), startsWith('/login'));
    auth.set(_signedIn);
    await tester.pumpAndSettle();
    expect(_loc(router), '/join/abc');
  });

  testWidgets('an https invite link is always allowed', (tester) async {
    final (router, _, _) = await _pump(tester);
    router.go('/join/xyz');
    await tester.pumpAndSettle();
    expect(_loc(router), '/join/xyz');
  });

  testWidgets('expired session redirects with from and returns after login',
      (tester) async {
    final (router, auth, _) = await _pump(tester, auth: _signedIn);
    router.go('/budget');
    await tester.pumpAndSettle();
    expect(_loc(router), '/budget');

    auth.set(const AuthState(loaded: true, expired: true));
    await tester.pumpAndSettle();
    final uri = router.routerDelegate.currentConfiguration.uri;
    expect(uri.path, '/session-expired');
    expect(uri.queryParameters['from'], '/budget');

    await tester.tap(find.text('আবার লগইন করুন'));
    await tester.pumpAndSettle();
    expect(_loc(router), startsWith('/login'));
    auth.set(_signedIn);
    await tester.pumpAndSettle();
    expect(_loc(router), '/budget');
  });

  testWidgets('tab switch keeps each tab scroll state', (tester) async {
    final (router, _, _) = await _pump(tester, auth: _signedIn);
    router.go('/talk');
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(0, -600));
    await tester.pumpAndSettle();
    double offset() => tester
        .state<ScrollableState>(find.byType(Scrollable).first)
        .position
        .pixels;
    final before = offset();
    expect(before, greaterThan(0));

    await tester.tap(find.text('বাজেট'));
    await tester.pumpAndSettle();
    expect(_loc(router), '/budget');
    expect(offset(), 0);

    await tester.tap(find.text('কথা'));
    await tester.pumpAndSettle();
    expect(_loc(router), '/talk');
    expect(offset(), before);
  });

  testWidgets('back from a pushed route returns to its tab', (tester) async {
    final (router, _, _) = await _pump(tester, auth: _signedIn);
    router.go('/list');
    await tester.pumpAndSettle();
    unawaited(router.push<void>('/summary'));
    await tester.pumpAndSettle();
    expect(
      router.routerDelegate.currentConfiguration.last.matchedLocation,
      '/summary',
    );
    router.pop();
    await tester.pumpAndSettle();
    expect(_loc(router), '/list');
  });

  testWidgets('an unknown route shows the not-found page with a way home',
      (tester) async {
    final (router, _, _) = await _pump(tester, auth: _signedIn);
    router.go('/nowhere');
    await tester.pumpAndSettle();
    expect(find.text('এটি খুঁজে পাওয়া যায়নি'), findsOneWidget);
    await tester.tap(find.text('হোমে যান'));
    await tester.pumpAndSettle();
    expect(_loc(router), '/home');
  });
}
