import 'package:amar_poribar/core/money/money_format.dart';
import 'package:amar_poribar/data/api/api_client.dart';
import 'package:amar_poribar/data/auth/session_manager.dart';
import 'package:amar_poribar/data/auth/token_store.dart';
import 'package:amar_poribar/features/settings/data/fake_profile_repository.dart';
import 'package:amar_poribar/features/settings/data/profile_repository.dart';
import 'package:amar_poribar/features/settings/state/preferences_controller.dart';
import 'package:amar_poribar/features/settings/ui/profile_screen.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:amar_poribar/presentation/providers/providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../goldens/golden_config.dart';
import '../../helpers/pump_app.dart';

class SignedIn extends AuthNotifier {
  SignedIn()
      : super(
          ApiClient(baseUrl: 'http://x', token: 't'),
          SessionManager(
            store: MemoryTokenStore(),
            refresh: (_) async => throw UnimplementedError(),
          ),
        ) {
    state = const AuthState(loaded: true, token: 't');
  }
}

List<Override> _overrides(FakeProfileRepository repo) => [
      profileRepositoryProvider.overrideWithValue(repo),
      authProvider.overrideWith((ref) => SignedIn()),
    ];

void main() {
  testWidgets('edits call the repository with only the changed fields',
      (tester) async {
    final repo = FakeProfileRepository();
    await pumpApp(tester, const ProfileScreen(), overrides: _overrides(repo));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('profile_num_latin')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('profile_simple_switch')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('profile_name')), 'আব্বা');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();

    expect(repo.updates.map((p) => p.toJson()).toList(), [
      {'bnDigits': false},
      {'simpleMode': true},
      {'name': 'আব্বা'},
    ]);
    expect(
      appContainer(tester).read(preferencesProvider).numeralStyle,
      NumeralStyle.latin,
    );
  });

  testWidgets('an offline edit is queued and applied later', (tester) async {
    final repo = FakeProfileRepository(failures: [ApiException(0, 'offline')]);
    await pumpApp(tester, const ProfileScreen(), overrides: _overrides(repo));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('profile_hide_switch')));
    await tester.pumpAndSettle();

    final c = appContainer(tester);
    expect(repo.updates, isEmpty);
    expect(c.read(preferencesProvider).hidePresence, isTrue);
    final store = c.read(localStoreProvider);
    expect(
      await tester.runAsync(() => store.getMeta('profile_patch')),
      '{"hidePresence":true}',
    );

    final flushed = await tester.runAsync(c.read(profileSyncProvider).flush);
    expect(flushed, isTrue);
    expect(repo.updates.single.toJson(), {'hidePresence': true});
    expect(
      await tester.runAsync(() => store.getMeta('profile_patch')),
      isEmpty,
    );
  });

  testWidgets('a rejected edit is rolled back', (tester) async {
    final repo = FakeProfileRepository(failures: [ApiException(422, 'no')]);
    await pumpApp(tester, const ProfileScreen(), overrides: _overrides(repo));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('profile_simple_switch')));
    await tester.pumpAndSettle();

    final c = appContainer(tester);
    expect(c.read(preferencesProvider).simpleMode, isFalse);
    expect(find.text('বদলানো যায়নি। আবার চেষ্টা করুন।'), findsOneWidget);
  });

  testWidgets('shows the presence label, reminder in words and the name',
      (tester) async {
    await pumpApp(
      tester,
      const ProfileScreen(),
      overrides: _overrides(FakeProfileRepository()),
    );
    await tester.pumpAndSettle();

    expect(find.text('আমার অবস্থা লুকাই'), findsOneWidget);
    expect(find.text('রাত ৯:০০ টায়'), findsOneWidget);
    expect(find.text('আমার প্রোফাইল'), findsOneWidget);
    expect(find.text('আমার তথ্য মুছুন'), findsOneWidget);
    expect(find.text('আব্বু'), findsOneWidget);
  });

  goldenScreen(
    'F8_profile',
    const ProfileScreen(),
    overrides: _overrides(FakeProfileRepository()),
  );
}
