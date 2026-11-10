import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('no double carries money in lib/', () {
    final bad = <String>[];
    final conv = RegExp(r'(?<!~)/ 100\b|\* 100\)');
    for (final f in Directory('lib')
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) => f.path.endsWith('.dart') && !f.path.contains('/gen/'))) {
      final lines = f.readAsLinesSync();
      for (var i = 0; i < lines.length; i++) {
        final l = lines[i];
        if (l.contains('double taka') ||
            (l.toLowerCase().contains('paisa') && conv.hasMatch(l))) {
          bad.add('${f.path}:${i + 1}: $l');
        }
      }
    }
    expect(bad, isEmpty);
  });
}
