import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

const _mb = 1024 * 1024;

/// A folder holding one `*-release.apk` of [mb] megabytes (sparse file).
Directory _fixture(String name, int mb) {
  final dir = Directory.systemTemp.createTempSync('apk');
  addTearDown(() => dir.deleteSync(recursive: true));
  final raf = File('${dir.path}/$name-release.apk').openSync(
    mode: FileMode.write,
  );
  raf.truncateSync(mb * _mb);
  raf.closeSync();
  return dir;
}

Future<ProcessResult> _run(String folder, String max) =>
    Process.run('dart', ['run', 'tool/check_apk_size.dart', folder, max]);

void main() {
  test('fails when an APK is 36 MB and the limit is 35', () async {
    final r = await _run(_fixture('app-arm64-v8a', 36).path, '35');
    expect(r.exitCode, 1);
  });

  test('passes when an APK is 30 MB and the limit is 35', () async {
    final r = await _run(_fixture('app-armeabi-v7a', 30).path, '35');
    expect(r.exitCode, 0);
    expect(r.stdout, contains('app-armeabi-v7a-release.apk'));
  });

  test('exits 2 when no release APK is found', () async {
    final dir = Directory.systemTemp.createTempSync('apk');
    addTearDown(() => dir.deleteSync(recursive: true));
    final r = await _run(dir.path, '35');
    expect(r.exitCode, 2);
  });
}
