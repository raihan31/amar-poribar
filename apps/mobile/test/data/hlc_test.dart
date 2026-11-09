import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:amar_poribar/data/sync/hlc.dart';

DateTime t(String s) => DateTime.parse(s);

void main() {
  // Same vectors as apps/api/src/hlc.test.ts, so both implementations behave identically.
  final v = jsonDecode(File('../../packages/shared/test-vectors/hlc.json')
      .readAsStringSync()) as Map<String, dynamic>;

  test('formats as a fixed-width string', () {
    for (final c in v['format'] as List) {
      final hlc = Hlc(t(c['time']), c['counter'] as int, c['node']);
      expect(hlc.toString(), c['text']);
      expect(Hlc.parse(c['text']), hlc);
    }
  });

  test('string order is the clock order', () {
    for (final c in v['ordering'] as List) {
      expect(
          Hlc.parse(c['lower']).compareTo(Hlc.parse(c['higher'])), lessThan(0));
      expect((c['lower'] as String).compareTo(c['higher']), lessThan(0));
    }
  });

  test('send', () {
    for (final c in v['send'] as List) {
      expect(Hlc.parse(c['clock']).send(t(c['now'])).toString(), c['result']);
    }
  });

  test('receive', () {
    for (final c in v['receive'] as List) {
      expect(
          Hlc.parse(c['clock'])
              .receive(Hlc.parse(c['remote']), t(c['now']))
              .toString(),
          c['result']);
    }
  });

  test('rejects a remote clock more than 24h ahead', () {
    for (final c in v['reject_drift'] as List) {
      expect(
          () => Hlc.parse(c['clock'])
              .receive(Hlc.parse(c['remote']), t(c['now'])),
          throwsA(isA<ClockDriftException>()));
    }
  });

  test('rejects text that is not an HLC', () {
    expect(() => Hlc.parse('nope'), throwsFormatException);
  });
}
