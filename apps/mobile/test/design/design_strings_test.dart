import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'screen_registry.dart';

const _totalScreens = 43;

String _norm(String s) => s
    .replaceAll(RegExp(r'\{[^}]*\}'), '')
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim();

Object? _json(String path) => jsonDecode(File(path).readAsStringSync());

void main() {
  // `flutter test` runs with cwd = apps/mobile.
  final design = (_json('../../docs/design/strings.json')!
      as Map<String, dynamic>)['screens'] as Map<String, dynamic>;
  final arb = _json('lib/l10n/app_bn.arb')! as Map<String, dynamic>;
  final arbValues = [
    for (final e in arb.entries)
      if (!e.key.startsWith('@') && e.value is String) _norm(e.value as String),
  ];
  final allowed = (_json('test/design/allowed_differences.json')! as List)
      .cast<Map<String, dynamic>>();

  test('every static design string exists in app_bn.arb', () {
    final problems = <String>[];
    for (final entry in implementedScreens.entries) {
      final screen = design[entry.key] as Map<String, dynamic>?;
      if (screen == null) {
        problems.add('${entry.key}: not a design screen');
        continue;
      }
      if (!File(entry.value).existsSync()) continue; // not merged yet
      final skip = {
        for (final a in allowed)
          if (a['screen'] == entry.key) _norm(a['design'] as String),
      };
      for (final raw in (screen['static'] as List).cast<String>()) {
        final s = _norm(raw);
        if (skip.contains(s)) continue;
        if (!arbValues.any((v) => v.contains(s))) {
          problems.add('${entry.key}: "$raw" is not in app_bn.arb');
        }
      }
    }
    expect(problems, isEmpty, reason: problems.join('\n'));
  });

  test('allowed differences are few and explained', () {
    expect(allowed.length, lessThanOrEqualTo(30));
    for (final a in allowed) {
      expect((a['reason'] as String?)?.trim() ?? '', isNotEmpty,
          reason: 'entry for ${a['screen']} needs a reason');
      expect(design.containsKey(a['screen']), isTrue,
          reason: 'unknown screen ${a['screen']}');
    }
  });

  test(
    'all 43 screens are registered (strict)',
    () {
      expect(design.length, _totalScreens);
      final missing =
          design.keys.where((k) => !implementedScreens.containsKey(k));
      expect(missing, isEmpty);
      for (final e in implementedScreens.entries) {
        expect(File(e.value).existsSync(), isTrue,
            reason: '${e.key}: ${e.value}');
      }
    },
    skip: implementedScreens.length < _totalScreens
        ? 'strict mode starts once all $_totalScreens screens are registered'
        : false,
  );
}
