import 'money.dart';

const _bn = '০১২৩৪৫৬৭৮৯';

/// Parses user input such as "৮৫০", "1,25,000", "৳ ৯৯" or "12.5" into [Money].
/// Returns null when it is not a valid amount (or has more than two decimals).
Money? parseTakaInput(String input) {
  var s = input.replaceAll('৳', '').replaceAll(',', '').replaceAll(' ', '');
  s = s.replaceAllMapped(RegExp('[$_bn]'), (m) => '${_bn.indexOf(m[0]!)}');
  final match = RegExp(r'^(\d+)(?:\.(\d{1,2}))?$').firstMatch(s);
  if (match == null) return null;
  final taka = int.parse(match[1]!);
  final frac = match[2] == null ? 0 : int.parse(match[2]!.padRight(2, '0'));
  return Money(taka * 100 + frac);
}
