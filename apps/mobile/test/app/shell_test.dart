import 'package:amar_poribar/app/shell.dart';
import 'package:amar_poribar/ui/bottom_tabs.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

Widget _app({int unread = 0}) {
  final router = GoRouter(
    initialLocation: '/a',
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (c, s, shell) => AppShell(navigationShell: shell),
        branches: [
          for (final p in ['/a', '/b', '/c', '/d', '/e'])
            StatefulShellBranch(
              routes: [
                GoRoute(path: p, builder: (c, s) => Text('page $p')),
              ],
            ),
        ],
      ),
    ],
  );
  return ProviderScope(
    overrides: [totalUnreadProvider.overrideWithValue(unread)],
    child: MaterialApp.router(routerConfig: router),
  );
}

void main() {
  testWidgets('shows the five tab labels exactly', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    for (final label in ['হোম', 'কথা', 'তালিকা', 'বাজেট', 'পরিবার']) {
      expect(find.text(label), findsOneWidget);
    }
    expect(AppBottomTabs.labels, ['হোম', 'কথা', 'তালিকা', 'বাজেট', 'পরিবার']);
  });

  testWidgets('badge shows ২ when totalUnreadProvider is 2', (tester) async {
    await tester.pumpWidget(_app(unread: 2));
    await tester.pumpAndSettle();
    expect(find.text('২'), findsOneWidget);
  });

  testWidgets('no badge when nothing is unread', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    expect(find.text('০'), findsNothing);
  });

  testWidgets('tapping a tab switches the branch', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    await tester.tap(find.text('বাজেট'));
    await tester.pumpAndSettle();
    expect(find.text('page /d'), findsOneWidget);
  });
}
