import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'a11y_helpers.dart';

Future<void> _pump(WidgetTester t, Widget body) async {
  t.view.physicalSize = const Size(390, 844);
  t.view.devicePixelRatio = 1;
  addTearDown(t.view.reset);
  await t.pumpWidget(MaterialApp(home: Scaffold(body: Center(child: body))));
}

Widget _tap(Widget child, {String? label, String? id}) => Semantics(
      button: true,
      label: label,
      container: id != null,
      identifier: id,
      excludeSemantics: true,
      onTap: () {},
      child: child,
    );

void main() {
  testWidgets('unlabeled GestureDetector fails', (t) async {
    final h = t.ensureSemantics();
    await _pump(
      t,
      GestureDetector(
        onTap: () {},
        child: const SizedBox(width: 60, height: 60),
      ),
    );
    await expectLater(expectAllTappablesLabelled(t), throwsA(anything));
    h.dispose();
  });

  testWidgets('40 dp button fails', (t) async {
    final h = t.ensureSemantics();
    await _pump(
      t,
      _tap(const SizedBox(width: 40, height: 40), label: 'সংরক্ষণ'),
    );
    await expectLater(expectAllTappablesLabelled(t), throwsA(anything));
    h.dispose();
  });

  testWidgets('English-only label fails', (t) async {
    final h = t.ensureSemantics();
    await _pump(t, _tap(const SizedBox(width: 60, height: 60), label: 'Save'));
    await expectLater(expectAllTappablesLabelled(t), throwsA(anything));
    h.dispose();
  });

  testWidgets('allow-listed brand word passes', (t) async {
    final h = t.ensureSemantics();
    await _pump(t, _tap(const SizedBox(width: 60, height: 60), label: 'bKash'));
    await expectAllTappablesLabelled(t);
    h.dispose();
  });

  testWidgets('labelled 56 dp button passes', (t) async {
    final h = t.ensureSemantics();
    await _pump(
      t,
      _tap(
        const SizedBox(width: 200, height: 56),
        label: 'সংরক্ষণ',
        id: 'primary',
      ),
    );
    await expectAllTappablesLabelled(t);
    h.dispose();
  });

  testWidgets('primary under 56 dp fails', (t) async {
    final h = t.ensureSemantics();
    await _pump(
      t,
      _tap(
        const SizedBox(width: 200, height: 50),
        label: 'সংরক্ষণ',
        id: 'primary',
      ),
    );
    await expectLater(expectAllTappablesLabelled(t), throwsA(anything));
    h.dispose();
  });

  testWidgets('chip without icon fails the colour-only check', (t) async {
    await _pump(t, const _IconlessChip());
    await expectLater(
      expectNoColourOnlyStatus(t, chips: find.byType(_IconlessChip)),
      throwsA(anything),
    );
  });

  testWidgets('low contrast text fails, good contrast passes', (t) async {
    await _pump(
      t,
      const ColoredBox(
        color: Color(0xFFFFFFFF),
        child: Text('ধূসর', style: TextStyle(color: Color(0xFFCCCCCC))),
      ),
    );
    await expectLater(expectContrast(t), throwsA(anything));
    await _pump(
      t,
      const ColoredBox(
        color: Color(0xFFFFFFFF),
        child: Text('কালো', style: TextStyle(color: Color(0xFF000000))),
      ),
    );
    await expectContrast(t);
  });
}

/// Stands in for a broken chip that shows text only.
class _IconlessChip extends StatelessWidget {
  const _IconlessChip();
  @override
  Widget build(BuildContext context) => const Text('ঠিক');
}
