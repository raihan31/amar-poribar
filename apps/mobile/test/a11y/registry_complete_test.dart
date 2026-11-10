import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'screen_registry.dart';

void main() {
  test('every route is registered or explicitly awaiting registration', () {
    final registered = registeredScreens.map((s) => s.route).toSet();
    final missing = kAllRoutes
        .where(
          (r) =>
              !registered.contains(r) &&
              !kRoutesAwaitingRegistration.contains(r),
        )
        .toList();
    expect(
      missing,
      isEmpty,
      reason: 'Add registerScreen(...) in test/a11y/screen_registry.dart '
          'for: $missing',
    );
  });

  test('awaiting list holds only real, unregistered routes', () {
    final registered = registeredScreens.map((s) => s.route).toSet();
    for (final r in kRoutesAwaitingRegistration) {
      expect(kAllRoutes, contains(r));
      expect(registered, isNot(contains(r)), reason: '$r is registered now');
    }
  });

  test('every board in docs/design/screens.json has a registry entry', () {
    final f = File('../../docs/design/screens.json');
    if (!f.existsSync()) {
      // Written by T-MOB-52; the check starts as soon as the file exists.
      return;
    }
    final boards = (jsonDecode(f.readAsStringSync()) as List)
        .where((b) => (b as Map)['platform'] == 'mobile')
        .map((b) => (b as Map)['code'] as String)
        .toSet();
    final codes = registeredScreens.map((s) => s.code).toSet();
    expect(boards.difference(codes), isEmpty);
  });
}
