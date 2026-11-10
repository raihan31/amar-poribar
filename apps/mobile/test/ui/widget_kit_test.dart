import 'package:amar_poribar/core/theme/ui_scale.dart';
import 'package:amar_poribar/ui/banner_strip.dart';
import 'package:amar_poribar/ui/big_mic_button.dart';
import 'package:amar_poribar/ui/empty_state.dart';
import 'package:amar_poribar/ui/icon_tile.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _app(Widget c, {UiScale scale = UiScale.normal}) => ProviderScope(
      key: UniqueKey(),
      overrides: [uiScaleProvider.overrideWith((ref) => scale)],
      child: MaterialApp(home: Scaffold(body: Center(child: c))),
    );

void main() {
  testWidgets('IconTile heights 84 and 112', (t) async {
    await t.pumpWidget(
      _app(IconTile(icon: Icons.add, label: 'খরচ', onTap: () {})),
    );
    expect(t.getSize(find.byType(IconTile)).height, IconTile.normalHeight);
    await t.pumpWidget(
      _app(
        IconTile(icon: Icons.add, label: 'খরচ', onTap: () {}),
        scale: UiScale.simple,
      ),
    );
    expect(t.getSize(find.byType(IconTile)).height, IconTile.simpleHeight);
  });

  testWidgets('BigMicButton sizes', (t) async {
    await t.pumpWidget(_app(BigMicButton(onPressed: () {})));
    expect(t.getSize(find.byType(BigMicButton)).height, BigMicButton.height);
    await t.pumpWidget(_app(BigMicButton.huge(onPressed: () {})));
    expect(t.getSize(find.byType(BigMicButton)).width, BigMicButton.hugeSize);
  });

  testWidgets('EmptyState shows message and action', (t) async {
    var n = 0;
    await t.pumpWidget(
      _app(
        EmptyState(
          icon: Icons.list,
          message: 'কিছু নেই',
          actionLabel: 'যোগ করুন',
          onAction: () => n++,
        ),
      ),
    );
    expect(find.text('কিছু নেই'), findsOneWidget);
    await t.tap(find.text('যোগ করুন'));
    expect(n, 1);
  });

  testWidgets('BannerStrip shows text and action', (t) async {
    await t.pumpWidget(
      _app(
        const BannerStrip(
          kind: BannerKind.warn,
          text: 'অফলাইন',
          actionLabel: 'আবার',
        ),
      ),
    );
    expect(find.text('অফলাইন'), findsOneWidget);
    expect(find.text('আবার'), findsOneWidget);
  });
}
