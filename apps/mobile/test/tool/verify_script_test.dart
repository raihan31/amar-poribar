import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  final script = File('tool/verify.sh');

  test('script exists and is executable', () {
    expect(script.existsSync(), isTrue);
    if (!Platform.isWindows) {
      expect(script.statSync().mode & 0x40, isNot(0), reason: 'owner x bit');
    }
  });

  test('defines every milestone M0..M8 in its table', () {
    final text = script.readAsStringSync();
    for (var n = 0; n <= 8; n++) {
      expect(
        RegExp('^M$n\\s+\\d+\\s+\\d+\\s*\$', multiLine: true).hasMatch(text),
        isTrue,
        reason: 'milestone M$n missing from the table',
      );
    }
  });

  test('root package.json has mobile:verify:m0..m8 delegating to it', () {
    final text = File('../../package.json').readAsStringSync();
    for (var n = 0; n <= 8; n++) {
      expect(
        text,
        contains('"mobile:verify:m$n": "cd apps/mobile && tool/verify.sh M$n"'),
      );
    }
  });

  test('--help prints usage and exits 0', () async {
    final r = await Process.run('bash', ['tool/verify.sh', '--help']);
    expect(r.exitCode, 0);
    expect(r.stdout as String, contains('Usage'));
  });

  test('unknown milestone exits 2', () async {
    final r = await Process.run('bash', ['tool/verify.sh', 'M9']);
    expect(r.exitCode, 2);
  });
}
