// Usage: dart run tool/check_apk_size.dart <folder> <max MB>
// Reads <folder>/*-release.apk, prints a size table, exits 1 if any APK is
// larger than max MB (1 MB = 1048576 bytes). Exits 2 on bad input.
import 'dart:io';

void main(List<String> args) {
  if (args.length != 2) {
    stderr.writeln('usage: check_apk_size <folder> <max MB>');
    exit(2);
  }
  final maxMb = int.tryParse(args[1]);
  final dir = Directory(args[0]);
  if (maxMb == null || !dir.existsSync()) {
    stderr.writeln('bad arguments: ${args.join(' ')}');
    exit(2);
  }
  const mb = 1024 * 1024;
  final limit = maxMb * mb;
  final apks = dir
      .listSync()
      .whereType<File>()
      .where((f) => f.path.endsWith('-release.apk'))
      .toList()
    ..sort((a, b) => a.path.compareTo(b.path));
  if (apks.isEmpty) {
    stderr.writeln('no *-release.apk in ${dir.path}');
    exit(2);
  }
  var failed = false;
  stdout.writeln('${'APK'.padRight(40)} ${'MB'.padLeft(8)}  status');
  for (final f in apks) {
    final bytes = f.lengthSync();
    final over = bytes > limit;
    failed = failed || over;
    final name = f.uri.pathSegments.last;
    // Integer arithmetic only: hundredths of a MB.
    final h = bytes * 100 ~/ mb;
    final size = '${h ~/ 100}.${(h % 100).toString().padLeft(2, '0')}';
    final status = over ? 'FAIL (> $maxMb MB)' : 'ok';
    stdout.writeln('${name.padRight(40)} ${size.padLeft(8)}  $status');
  }
  exit(failed ? 1 : 0);
}
