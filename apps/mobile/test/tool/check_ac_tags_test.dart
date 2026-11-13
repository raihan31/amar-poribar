import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import '../../tool/check_ac_tags.dart';

late Directory root;

void put(String rel, String body) {
  final f = File('${root.path}/$rel')..createSync(recursive: true);
  f.writeAsStringSync(body);
}

File map(List<Map<String, Object?>> entries) =>
    File('${root.path}/map.json')..writeAsStringSync(jsonEncode(entries));

List<String> run(File m, {bool strict = false}) =>
    checkAcTags(mapFile: m, roots: [root.path], strict: strict);

void main() {
  setUp(() => root = Directory.systemTemp.createTempSync('ac'));
  tearDown(() => root.deleteSync(recursive: true));

  test('passes when every listed AC has a named test in the named file', () {
    put('test/a_test.dart', "void main(){ test('AC-08: x', () {}); }");
    put(
      'test/b_test.dart',
      'void main(){ testWidgets(\n  "AC-08 y", (t) async {}); }',
    );
    final m = map([
      {
        'ac': 'AC-08',
        'tests': ['a_test: AC-08', 'b_test: AC-08'],
      },
    ]);
    expect(run(m), isEmpty);
  });

  test('fails when a listed AC has no matching test', () {
    put('test/a_test.dart', "void main(){ test('AC-09: x', () {}); }");
    final m = map([
      {
        'ac': 'AC-08',
        'tests': ['a_test: AC-08'],
      },
    ]);
    expect(run(m).first, contains('AC-08'));
  });

  test('fails when a test cites an AC that is not in the map', () {
    put('test/a_test.dart', "void main(){ test('AC-99: x', () {}); }");
    expect(run(map([])).single, contains('AC-99'));
  });

  test('the AC id must start the name, not just appear in it', () {
    put('test/a_test.dart', "void main(){ test('x (AC-08)', () {}); }");
    final m = map([
      {
        'ac': 'AC-08',
        'tests': ['a_test: AC-08'],
      },
    ]);
    expect(run(m), isNotEmpty);
  });

  test('scans integration_test too, and wrappers like homeTest', () {
    put(
      'integration_test/i_test.dart',
      "void main(){ homeTest('AC-17: x', (t) async {}); }",
    );
    final m = map([
      {
        'ac': 'AC-17',
        'tests': ['i_test: AC-17'],
      },
    ]);
    expect(run(m), isEmpty);
  });

  test('pending ACs pass normally and fail in strict mode', () {
    final m = map([
      {'ac': 'AC-11', 'tests': <String>[], 'pending': 'T-MOB-50'},
    ]);
    expect(run(m), isEmpty);
    expect(run(m, strict: true).single, contains('AC-11'));
  });

  test('a pending AC that already has a test is reported as stale', () {
    put('test/a_test.dart', "void main(){ test('AC-11: x', () {}); }");
    final m = map([
      {
        'ac': 'AC-11',
        'tests': ['a_test: AC-11'],
        'pending': 'T-MOB-50',
      },
    ]);
    expect(run(m).single, contains('pending'));
  });

  test('the real map passes against the real tests', () {
    expect(
      checkAcTags(
        mapFile: File('../../docs/tasks/ac-mobile.json'),
        roots: ['test', 'integration_test'],
      ),
      isEmpty,
    );
  });
}
