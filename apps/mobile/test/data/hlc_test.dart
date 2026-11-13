import 'dart:convert';
import 'dart:io';

import 'package:amar_poribar/data/sync/hlc.dart';
import 'package:flutter_test/flutter_test.dart';

DateTime t(String s) => DateTime.parse(s);

void main() {
  // Same vectors as apps/api/src/hlc.test.ts, so both implementations behave identically.
  final v = jsonDecode(
    File('../../packages/shared/test-vectors/hlc.json').readAsStringSync(),
  ) as Map<String, dynamic>;

  test('formats as a fixed-width string', () {
    for (final c in (v['format'] as List).cast<Map<String, dynamic>>()) {
      final hlc = Hlc(
        t((c['time'] as String)),
        (c['counter'] as int),
        (c['node'] as String),
      );
      expect(hlc.toString(), (c['text'] as String));
      expect(Hlc.parse((c['text'] as String)), hlc);
    }
  });

  test('AC-24: string order is the clock order', () {
    for (final c in (v['ordering'] as List).cast<Map<String, dynamic>>()) {
      expect(
        Hlc.parse((c['lower'] as String))
            .compareTo(Hlc.parse((c['higher'] as String))),
        lessThan(0),
      );
      expect(
        (c['lower'] as String).compareTo((c['higher'] as String)),
        lessThan(0),
      );
    }
  });

  test('send', () {
    for (final c in (v['send'] as List).cast<Map<String, dynamic>>()) {
      expect(
        Hlc.parse((c['clock'] as String))
            .send(t((c['now'] as String)))
            .toString(),
        (c['result'] as String),
      );
    }
  });

  test('receive', () {
    for (final c in (v['receive'] as List).cast<Map<String, dynamic>>()) {
      expect(
        Hlc.parse((c['clock'] as String))
            .receive(
              Hlc.parse((c['remote'] as String)),
              t((c['now'] as String)),
            )
            .toString(),
        (c['result'] as String),
      );
    }
  });

  test('rejects a remote clock more than 24h ahead', () {
    for (final c in (v['reject_drift'] as List).cast<Map<String, dynamic>>()) {
      expect(
        () => Hlc.parse((c['clock'] as String)).receive(
          Hlc.parse((c['remote'] as String)),
          t((c['now'] as String)),
        ),
        throwsA(isA<ClockDriftException>()),
      );
    }
  });

  test('rejects text that is not an HLC', () {
    expect(() => Hlc.parse('nope'), throwsFormatException);
  });
}
