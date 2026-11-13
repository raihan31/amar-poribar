import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// An lcov file with [hit] of 100 lines covered in lib/core/a.dart, plus an
/// uncovered file outside the checked folders.
String _lcov(int hit) => 'SF:lib/core/a.dart\nLF:100\nLH:$hit\nend_of_record\n'
    'SF:lib/presentation/x.dart\nLF:100\nLH:0\nend_of_record\n';

Future<int> _run(int hit, String threshold) async {
  final dir = Directory.systemTemp.createTempSync('cov');
  addTearDown(() => dir.deleteSync(recursive: true));
  final f = File('${dir.path}/lcov.info')..writeAsStringSync(_lcov(hit));
  final r = await Process.run('dart', [
    'run',
    'tool/check_coverage.dart',
    threshold,
    'lib/core',
    f.path,
  ]);
  return r.exitCode;
}

void main() {
  test('passes on a fixture lcov at 80%', () async {
    expect(await _run(80, '70'), 0);
  });

  test('fails on a fixture lcov at 60%', () async {
    expect(await _run(60, '70'), 1);
  });
}
