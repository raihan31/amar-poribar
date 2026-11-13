import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/features/entry/ui/category_picker_screen.dart';
import 'package:amar_poribar/features/transactions/state/add_expense_controller.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../../helpers/fake_voice_service.dart';
import '../../helpers/pump_app.dart';
import '../transactions/add_expense_fixtures.dart';

const _args = CategoryPickerArgs(amountPaisa: 50000, caption: 'ক্যাশ · আজ');

void main() {
  testWidgets('tap speaks the Bangla name', (t) async {
    await pumpApp(
      t,
      const CategoryPickerScreen(args: _args),
      overrides: [
        addCategoriesProvider.overrideWith((ref) async => kFixtureCategories),
      ],
    );
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('pick_c-rent')));
    await t.pump();
    final voice =
        appContainer(t).read(voiceServiceProvider) as FakeVoiceService;
    expect(voice.spoken, ['বাসা ভাড়া']);
    expect(find.text('✓ বাসা ভাড়া'), findsOneWidget);
    expect(find.text('বাসা ভাড়ায় রাখুন'), findsOneWidget);
  });

  testWidgets('only visible categories of the kind are shown', (t) async {
    await pumpApp(
      t,
      const CategoryPickerScreen(args: _args),
      overrides: [
        addCategoriesProvider.overrideWith((ref) async => kFixtureCategories),
      ],
    );
    await t.pumpAndSettle();
    expect(find.text('বাজার ও মুদি'), findsOneWidget);
    expect(find.text('গ্যাস বিল'), findsNothing);
    expect(find.text('বেতন'), findsNothing);
  });

  testWidgets('confirm returns the selection', (t) async {
    CachedCategory? result;
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (c, _) => Scaffold(
            body: TextButton(
              onPressed: () async =>
                  result = await c.push<CachedCategory>('/pick'),
              child: const Text('open'),
            ),
          ),
        ),
        GoRoute(
          path: '/pick',
          builder: (_, __) => const CategoryPickerScreen(args: _args),
        ),
      ],
    );
    await pumpApp(
      t,
      const SizedBox(),
      router: router,
      overrides: [
        addCategoriesProvider.overrideWith((ref) async => kFixtureCategories),
      ],
    );
    await t.tap(find.text('open'));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('pick_c-bazaar')));
    await t.pump();
    await t.tap(find.byKey(const Key('picker_confirm')));
    await t.pumpAndSettle();
    expect(result?.id, 'c-bazaar');
  });
}
