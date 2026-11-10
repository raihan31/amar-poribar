import 'package:amar_poribar/core/theme/app_theme.dart';
import 'package:amar_poribar/core/theme/ui_scale.dart';
import 'package:amar_poribar/domain/models/member.dart';
import 'package:amar_poribar/ui/big_button.dart';
import 'package:amar_poribar/ui/big_mic_button.dart';
import 'package:amar_poribar/ui/icon_tile.dart';
import 'package:amar_poribar/ui/listen_button.dart';
import 'package:amar_poribar/ui/member_avatar.dart';
import 'package:amar_poribar/ui/status_chip.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'a11y_helpers.dart';
import 'screen_registry.dart';

Future<void> _pumpScreen(
  WidgetTester t,
  WidgetBuilder screen,
  List<Override> overrides,
  UiScale scale,
) async {
  t.view.physicalSize = const Size(390, 844);
  t.view.devicePixelRatio = 1;
  addTearDown(t.view.reset);
  await t.pumpWidget(
    ProviderScope(
      overrides: [uiScaleProvider.overrideWith((ref) => scale), ...overrides],
      child: MaterialApp(
        theme: lightTheme(scale),
        home: Builder(builder: screen),
      ),
    ),
  );
  await t.pump();
}

Future<void> _runAll(WidgetTester t) async {
  await expectAllTappablesLabelled(t);
  await expectNoColourOnlyStatus(t);
  await expectContrast(t);
}

void main() {
  group('widget kit', () {
    for (final scale in UiScale.values) {
      testWidgets('kit passes all helpers in ${scale.name} mode', (t) async {
        final h = t.ensureSemantics();
        await _pumpScreen(
          t,
          (c) => Scaffold(
            body: ListView(
              children: [
                BigButton(label: 'সংরক্ষণ', onPressed: () {}),
                BigButton(
                  label: 'বাতিল',
                  style: BigButtonStyle.outline,
                  onPressed: () {},
                ),
                IconTile(icon: Icons.add, label: 'খরচ', onTap: () {}),
                BigMicButton(onPressed: () {}),
                const ListenButton(text: 'পরীক্ষা'),
                const MemberAvatar(
                  m: Member(id: '1', name: 'আম্মু'),
                  online: true,
                  showLabel: true,
                ),
                const StatusChip(kind: StatusKind.ok, label: 'ঠিক আছে'),
              ],
            ),
          ),
          const [],
          scale,
        );
        await _runAll(t);
        h.dispose();
      });
    }
  });

  group('registered screens', () {
    for (final s in registeredScreens) {
      for (final scale in UiScale.values) {
        testWidgets('${s.code} ${s.route} in ${scale.name} mode', (t) async {
          final h = t.ensureSemantics();
          await _pumpScreen(t, s.factory, s.needs, scale);
          await _runAll(t);
          h.dispose();
        });
      }
    }
  });
}
