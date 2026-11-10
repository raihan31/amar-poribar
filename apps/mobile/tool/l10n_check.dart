// Usage: dart run tool/l10n_check.dart
// Fails when the bn and en catalogues differ, a key is unused in lib/, or a bn value has English
// letters outside {placeholders}, ICU keywords and brand names.
import 'dart:convert';
import 'dart:io';

const brands = ['bKash', 'Nagad', 'Rocket', 'TrxID', 'OTP', 'SMS', 'CSV', 'QR'];

Map<String, String> _load(File f) {
  final json = jsonDecode(f.readAsStringSync()) as Map<String, dynamic>;
  return {
    for (final e in json.entries)
      if (!e.key.startsWith('@')) e.key: e.value as String,
  };
}

/// Drops `{placeholders}` and ICU plural/select syntax, keeping the copy inside plural branches,
/// e.g. `{n, plural, other{{n}টি}}` leaves `টি`.
String _stripPlaceholders(String s) => s
    .replaceAll(RegExp(r'\{\w+\s*,\s*(plural|select)\s*,'), '')
    .replaceAll(RegExp(r'(=\d+|zero|one|two|few|many|other)\{'), '')
    .replaceAll(RegExp(r'\{\w+\}'), '')
    .replaceAll(RegExp(r'[{}]'), '');

/// Returns one message per problem; empty means the catalogues are healthy.
List<String> checkL10n({required String arbDir, required String libDir}) {
  final bnFile = File('$arbDir/app_bn.arb');
  final enFile = File('$arbDir/app_en.arb');
  final bn = _load(bnFile);
  final en = _load(enFile);
  final problems = <String>[];

  for (final k in bn.keys.where((k) => !en.containsKey(k))) {
    problems.add('key $k missing in app_en.arb');
  }
  for (final k in en.keys.where((k) => !bn.containsKey(k))) {
    problems.add('key $k missing in app_bn.arb');
  }

  final source = StringBuffer();
  for (final f in Directory(libDir).listSync(recursive: true)) {
    if (f is! File || !f.path.endsWith('.dart')) continue;
    final p = f.path.replaceAll('\\', '/');
    if (p.contains('/l10n/gen/')) continue;
    source.writeln(f.readAsStringSync());
  }
  final text = source.toString();
  for (final k in {...bn.keys, ...en.keys}) {
    if (!RegExp('l10n\\.$k\\b').hasMatch(text)) problems.add('unused key $k');
  }

  for (final e in bn.entries) {
    var v = _stripPlaceholders(e.value);
    for (final b in brands) {
      v = v.replaceAll(b, '');
    }
    if (RegExp('[A-Za-z]').hasMatch(v)) {
      problems.add('bn value of ${e.key} has English letters: "${e.value}"');
    }
  }
  return problems;
}

void main() {
  final problems = checkL10n(arbDir: 'lib/l10n', libDir: 'lib');
  if (problems.isEmpty) {
    stdout.writeln('l10n ok');
    return;
  }
  problems.forEach(stderr.writeln);
  exit(1);
}
