import 'package:amar_poribar/core/theme/ui_scale.dart';
import 'package:amar_poribar/ui/big_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _app(Widget child, {UiScale scale = UiScale.normal}) => ProviderScope(
      overrides: [uiScaleProvider.overrideWith((ref) => scale)],
      child: MaterialApp(home: Scaffold(body: Center(child: child))),
    );

void main() {
  testWidgets('height 56 in normal mode', (t) async {
    await t.pumpWidget(_app(BigButton(label: 'সংরক্ষণ', onPressed: () {})));
    expect(t.getSize(find.byType(BigButton)).height, 56);
  });

  testWidgets('height 72 in simple mode', (t) async {
    await t.pumpWidget(
      _app(
        BigButton(label: 'সংরক্ষণ', onPressed: () {}),
        scale: UiScale.simple,
      ),
    );
    expect(t.getSize(find.byType(BigButton)).height, 72);
  });

  testWidgets('semantics label equals label', (t) async {
    final h = t.ensureSemantics();
    await t.pumpWidget(_app(BigButton(label: 'সংরক্ষণ', onPressed: () {})));
    expect(
      t.getSemantics(find.byType(BigButton)),
      matchesSemantics(
        label: 'সংরক্ষণ',
        isButton: true,
        isEnabled: true,
        hasEnabledState: true,
        hasTapAction: true,
      ),
    );
    h.dispose();
  });

  testWidgets('disabled has no tap', (t) async {
    await t
        .pumpWidget(_app(const BigButton(label: 'সংরক্ষণ', onPressed: null)));
    await t.tap(find.text('সংরক্ষণ'), warnIfMissed: false);
    final h = t.ensureSemantics();
    expect(
      t
          .getSemantics(find.byType(BigButton))
          .getSemanticsData()
          .hasAction(SemanticsAction.tap),
      isFalse,
    );
    h.dispose();
  });
}
