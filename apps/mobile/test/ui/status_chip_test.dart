import 'package:amar_poribar/ui/status_chip.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  for (final kind in StatusKind.values) {
    testWidgets('$kind has an icon and text', (t) async {
      await t.pumpWidget(
        MaterialApp(
          home: Scaffold(body: StatusChip(kind: kind, label: 'ঠিক আছে')),
        ),
      );
      expect(find.text('ঠিক আছে'), findsOneWidget);
      expect(find.byIcon(StatusChip.iconFor(kind)), findsOneWidget);
    });
  }

  test('icons differ per kind', () {
    final icons = StatusKind.values.map(StatusChip.iconFor).toSet();
    expect(icons.length, StatusKind.values.length);
  });
}
