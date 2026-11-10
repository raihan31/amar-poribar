// Usage: dart run tool/check_coverage.dart <min%> <folder>... <lcov.info>
// Sums line coverage of files under the given folders; exits 1 below min%.
import 'dart:io';

void main(List<String> args) {
  if (args.length < 3) {
    stderr.writeln('usage: check_coverage <min%> <folder>... <lcov.info>');
    exit(2);
  }
  final min = double.parse(args.first);
  final lcov = File(args.last);
  final folders = args.sublist(1, args.length - 1).map((f) => '$f/').toList();
  if (!lcov.existsSync()) {
    stderr.writeln('missing ${lcov.path}');
    exit(2);
  }
  var found = 0;
  var hit = 0;
  var include = false;
  for (final line in lcov.readAsLinesSync()) {
    if (line.startsWith('SF:')) {
      final path = line.substring(3).replaceAll('\\', '/');
      // Generated code is not ours to cover.
      include = folders.any(path.startsWith) &&
          !path.endsWith('.g.dart') &&
          !path.endsWith('.freezed.dart');
    } else if (include && line.startsWith('LF:')) {
      found += int.parse(line.substring(3));
    } else if (include && line.startsWith('LH:')) {
      hit += int.parse(line.substring(3));
    }
  }
  final pct = found == 0 ? 0.0 : hit * 100 / found;
  stdout.writeln(
    'coverage ${pct.toStringAsFixed(1)}% ($hit/$found lines) '
    'in ${folders.join(', ')}',
  );
  if (pct < min) {
    stderr.writeln('below the $min% threshold');
    exit(1);
  }
}
