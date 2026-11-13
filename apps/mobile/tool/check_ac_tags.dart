// Usage: dart run tool/check_ac_tags.dart <map.json> [--strict]
// Checks that every acceptance criterion in the map is covered by a test whose name starts with
// the AC id (`test('AC-08: ...'`, `testWidgets('AC-08 ...'`), and that no test cites an AC that
// the map does not list (the golden helper's `acTag: 'AC-26'` counts too). Scans test/ and integration_test/.
// An entry with "pending": "<task id>" is an AC whose test belongs to a later task: it passes
// unless --strict. A pending entry that already has a test is stale and fails.
import 'dart:convert';
import 'dart:io';

// A test name starting with the id, or `acTag: 'AC-26'` passed to the golden helper, which
// prefixes the generated test name with it.
final _tagged = RegExp(
  r'''(?:\b\w*[Tt]est\w*\(\s*|\bacTag:\s*)(['"])(AC-\d+)\b''',
);

/// Maps file stem (`quick_parser_test`) to the AC ids its test names start with.
Map<String, Set<String>> scanTags(List<String> roots) {
  final found = <String, Set<String>>{};
  for (final root in roots) {
    final dir = Directory(root);
    if (!dir.existsSync()) continue;
    for (final f in dir.listSync(recursive: true).whereType<File>()) {
      final name = f.uri.pathSegments.last;
      // The checker's own test holds fixture sources that mention AC ids.
      if (!name.endsWith('.dart') || name == 'check_ac_tags_test.dart') {
        continue;
      }
      final stem = name.replaceAll(RegExp(r'\.dart$'), '');
      for (final m in _tagged.allMatches(f.readAsStringSync())) {
        found.putIfAbsent(stem, () => {}).add(m.group(2)!);
      }
    }
  }
  return found;
}

/// Returns one message per problem; empty means the map and the tests agree.
List<String> checkAcTags({
  required File mapFile,
  required List<String> roots,
  bool strict = false,
}) {
  final problems = <String>[];
  final entries = (jsonDecode(mapFile.readAsStringSync()) as List)
      .cast<Map<String, dynamic>>();
  final found = scanTags(roots);
  final listed = {for (final e in entries) e['ac'] as String};

  for (final e in entries) {
    final ac = e['ac'] as String;
    final pending = e['pending'] as String?;
    final tests = (e['tests'] as List).cast<String>();
    if (pending != null) {
      if (strict) problems.add('$ac is pending ($pending): no test yet');
      if (tests.isNotEmpty) {
        problems.add('$ac has tests but is still marked pending ($pending)');
      }
      continue;
    }
    if (tests.isEmpty) problems.add('$ac lists no tests');
    for (final t in tests) {
      final parts = t.split(': ');
      final stem = parts.first.trim();
      final id = parts.length > 1 ? parts.last.trim() : ac;
      if (id != ac || !(found[stem]?.contains(ac) ?? false)) {
        problems.add('$ac: no test named "$ac ..." in $stem.dart');
      }
    }
  }
  found.forEach((stem, acs) {
    for (final ac in acs.where((a) => !listed.contains(a))) {
      problems.add('$stem.dart cites $ac, which is not in the map');
    }
  });
  return problems;
}

void main(List<String> args) {
  final strict = args.contains('--strict');
  final paths = args.where((a) => !a.startsWith('--')).toList();
  if (paths.length != 1) {
    stderr.writeln(
      'usage: dart run tool/check_ac_tags.dart <map.json> [--strict]',
    );
    exit(2);
  }
  final problems = checkAcTags(
    mapFile: File(paths.single),
    roots: ['test', 'integration_test'],
    strict: strict,
  );
  if (problems.isEmpty) {
    stdout.writeln('AC tag map: OK');
    return;
  }
  problems.forEach(stderr.writeln);
  exit(1);
}
