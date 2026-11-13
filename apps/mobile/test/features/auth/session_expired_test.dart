import 'package:amar_poribar/app/app.dart';
import 'package:amar_poribar/app/redirects.dart';
import 'package:amar_poribar/app/router.dart';
import 'package:amar_poribar/data/api/api_client.dart';
import 'package:amar_poribar/data/auth/session_manager.dart';
import 'package:amar_poribar/data/auth/token_store.dart';
import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:amar_poribar/features/auth/data/auth_repository.dart';
import 'package:amar_poribar/features/auth/data/fake_auth_repository.dart';
import 'package:amar_poribar/features/auth/state/login_controller.dart';
import 'package:amar_poribar/features/auth/state/session_owner.dart';
import 'package:amar_poribar/features/family/state/family_providers.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import '../../helpers/fake_voice_service.dart';
import '../../helpers/fakes.dart';

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
  _FakeAuth()
      : super(
          _Api(),
          SessionManager(
            store: _NoTokens(),
            refresh: (_) async => throw UnimplementedError(),
          ),
        );

  void set(AuthState s) => state = s;
}

const _family = FamilyInfo('f1', 'রহিম পরিবার', 'owner');
const _signedIn = AuthState(loaded: true, token: 't', families: [_family]);

class _Harness {
  _Harness(this.router, this.auth, this.store, this.container);
  final GoRouter router;
  final _FakeAuth auth;
  final LocalStore store;
  final ProviderContainer container;

  String get location =>
      router.routerDelegate.currentConfiguration.uri.toString();
}

Future<_Harness> _pump(
  WidgetTester t, {
  String signedInUser = 'u-me',
  String? dbOwner,
}) async {
  t.view.physicalSize = const Size(390, 844);
  t.view.devicePixelRatio = 1;
  addTearDown(t.view.reset);
  final store =
      (await t.runAsync(() => LocalStore.open(AppDatabase.memory())))!;
  addTearDown(() => t.runAsync(store.db.close));
  await t.runAsync(() async {
    await store.addTransaction(type: 'expense', amountPaisa: 25000);
    if (dbOwner != null) await store.setMeta(dbOwnerKey, dbOwner);
  });
  final auth = _FakeAuth()..set(_signedIn);
  await t.pumpWidget(
    ProviderScope(
      overrides: [
        ...defaultFakes(store: store, voice: FakeVoiceService()),
        authProvider.overrideWith((ref) => auth),
        welcomeDoneProvider.overrideWith((ref) => true),
        myUserIdProvider.overrideWith((ref) async => signedInUser),
        authRepositoryProvider.overrideWithValue(FakeAuthRepository()),
        loginSignedInProvider
            .overrideWithValue(() async => auth.set(_signedIn)),
      ],
      child: const AmarPoribarApp(),
    ),
  );
  await t.pumpAndSettle();
  final container = ProviderScope.containerOf(
    t.element(find.byType(AmarPoribarApp)),
  );
  return _Harness(container.read(routerProvider), auth, store, container);
}

/// Session ends while the person is on the budget tab, then they sign in again.
Future<void> _expireAndSignIn(WidgetTester t, _Harness h) async {
  h.router.go('/budget');
  await t.pumpAndSettle();
  h.auth.set(const AuthState(loaded: true, expired: true));
  await t.pumpAndSettle();
  await t.tap(find.byKey(const Key('session_expired_sign_in')));
  await t.pumpAndSettle();
  await t.enterText(find.bySemanticsLabel('মোবাইল নম্বর'), '01712345678');
  await t.tap(find.text('ঢুকুন'));
  await t.pumpAndSettle();
  await t.enterText(find.bySemanticsLabel('৬ সংখ্যার কোড'), '123456');
  await t.pumpAndSettle();
  await t.tap(find.text('ঢুকুন'));
  await t.pumpAndSettle();
}

Future<int> _txnCount(WidgetTester t, LocalStore s) async =>
    (await t.runAsync(() => s.recent()))!.length;

/// Ends each test with an empty tree so the login resend timer is cancelled.
void _test(String name, Future<void> Function(WidgetTester) body) =>
    testWidgets(name, (t) async {
      await body(t);
      await t.pumpWidget(const SizedBox());
    });

void main() {
  _test('expired session redirects here with from', (t) async {
    final h = await _pump(t);
    h.router.go('/budget');
    await t.pumpAndSettle();
    h.auth.set(const AuthState(loaded: true, expired: true));
    await t.pumpAndSettle();
    final uri = h.router.routerDelegate.currentConfiguration.uri;
    expect(uri.path, Routes.sessionExpired);
    expect(uri.queryParameters['from'], '/budget');
    expect(find.text('আবার ঢুকুন'), findsOneWidget);
    expect(
      find.text(
        'আপনার নিরাপত্তার জন্য কিছুদিন পর আবার ঢুকতে হয়। আপনার হিসাব ঠিকই আছে।',
      ),
      findsOneWidget,
    );
  });

  _test('AC-13: sign-in returns to from, local transactions kept', (t) async {
    final h = await _pump(t, dbOwner: 'u-me');
    await _expireAndSignIn(t, h);
    expect(h.location, '/budget');
    expect(await _txnCount(t, h.store), 1);
  });

  _test('first sign-in claims the local database', (t) async {
    final h = await _pump(t);
    await _expireAndSignIn(t, h);
    expect(h.location, '/budget');
    expect(await t.runAsync(() => h.store.getMeta(dbOwnerKey)), 'u-me');
  });

  _test('other number asks first; "না" returns to login, data kept', (t) async {
    final h = await _pump(t, dbOwner: 'u-someone-else');
    await _expireAndSignIn(t, h);
    expect(
      find.text('এটি অন্য নম্বর। এই ফোনের আগের তথ্য মুছে ফেলব?'),
      findsOneWidget,
    );
    await t.tap(find.text('না'));
    await t.pumpAndSettle();
    expect(h.location, startsWith(Routes.login));
    expect(h.location, isNot(contains('/code')));
    expect(await _txnCount(t, h.store), 1);
    expect(
      await t.runAsync(() => h.store.getMeta(dbOwnerKey)),
      'u-someone-else',
    );
  });

  _test('other number: yes wipes the old data and opens /home', (t) async {
    final h = await _pump(t, dbOwner: 'u-someone-else');
    await _expireAndSignIn(t, h);
    await t.tap(find.text('হ্যাঁ, মুছে ফেলুন'));
    await t.pumpAndSettle();
    expect(h.location, Routes.home);
    expect(await _txnCount(t, h.store), 0);
    expect(await t.runAsync(() => h.store.getMeta(dbOwnerKey)), 'u-me');
  });
}
