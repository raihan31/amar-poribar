import 'package:amar_poribar/ui/bottom_tabs.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _app(Widget child) => MaterialApp(
      home: Scaffold(bottomNavigationBar: child, body: const SizedBox()),
    );

void main() {
  testWidgets('five labels exactly', (t) async {
    await t.pumpWidget(_app(AppBottomTabs(index: 0, onSelect: (_) {})));
    for (final l in ['হোম', 'কথা', 'তালিকা', 'বাজেট', 'পরিবার']) {
      expect(find.text(l), findsOneWidget);
    }
    expect(AppBottomTabs.labels.length, 5);
  });

  testWidgets('badge shows Bangla digit', (t) async {
    await t.pumpWidget(
      _app(AppBottomTabs(index: 0, onSelect: (_) {}, chatBadge: 2)),
    );
    expect(find.text('২'), findsOneWidget);
  });

  testWidgets('no badge when zero', (t) async {
    await t.pumpWidget(_app(AppBottomTabs(index: 0, onSelect: (_) {})));
    expect(find.text('০'), findsNothing);
  });

  testWidgets('each tab at least 48 wide and bar is 72 tall', (t) async {
    await t.pumpWidget(_app(AppBottomTabs(index: 0, onSelect: (_) {})));
    expect(t.getSize(find.byType(AppBottomTabs)).height, 72);
    for (final l in AppBottomTabs.labels) {
      final tab =
          find.ancestor(of: find.text(l), matching: find.byType(InkWell));
      expect(t.getSize(tab).width, greaterThanOrEqualTo(48));
    }
  });

  testWidgets('tap selects', (t) async {
    int? got;
    await t.pumpWidget(_app(AppBottomTabs(index: 0, onSelect: (i) => got = i)));
    await t.tap(find.text('বাজেট'));
    expect(got, 3);
  });
}
