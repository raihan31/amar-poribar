import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('lib/features and lib/ui use no raw Colors.* except transparent/white',
      () {
    final re = RegExp(r'\bColors\.(?!transparent\b|white\b)\w+');
    final hits = <String>[];
    for (final dir in ['lib/features', 'lib/ui']) {
      final d = Directory(dir);
      if (!d.existsSync()) continue;
      for (final f in d.listSync(recursive: true).whereType<File>()) {
        if (!f.path.endsWith('.dart')) continue;
        final lines = f.readAsLinesSync();
        for (var i = 0; i < lines.length; i++) {
          if (re.hasMatch(lines[i])) hits.add('${f.path}:${i + 1}');
        }
      }
    }
    expect(hits, isEmpty);
  });
}
