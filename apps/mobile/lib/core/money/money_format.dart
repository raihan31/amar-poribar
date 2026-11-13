import 'money.dart';

enum NumeralStyle { bangla, latin }

const _bnDigits = '০১২৩৪৫৬৭৮৯';

/// Replaces ASCII digits with Bangla digits; other characters are kept.
String toBanglaDigits(String s) => s.replaceAllMapped(
      RegExp(r'[0-9]'),
      (m) => _bnDigits[int.parse(m[0]!)],
    );

/// Replaces Bangla digits with ASCII digits; other characters are kept.
String toLatinDigits(String s) => s.replaceAllMapped(
      RegExp('[০-৯]'),
      (m) => _bnDigits.indexOf(m[0]!).toString(),
    );

/// South Asian grouping: last three digits, then pairs.
String _group(String digits) {
  if (digits.length <= 3) return digits;
  final head = digits.substring(0, digits.length - 3);
  final tail = digits.substring(digits.length - 3);
  final parts = <String>[];
  for (var i = head.length; i > 0; i -= 2) {
    parts.insert(0, head.substring(i < 2 ? 0 : i - 2, i));
  }
  return '${parts.join(',')},$tail';
}

/// `৳ ১,২৫,০০০` or `৳ 1,25,000`. Negative amounts always show `−`;
/// [signed] also shows `+` for positive amounts.
String formatMoney(
  Money m, {
  required NumeralStyle style,
  bool showSymbol = true,
  bool signed = false,
}) {
  final abs = m.paisa.abs();
  final taka = abs ~/ 100;
  final rem = abs % 100;
  var body = _group(taka.toString());
  if (rem != 0) body = '$body.${rem.toString().padLeft(2, '0')}';
  if (style == NumeralStyle.bangla) body = toBanglaDigits(body);
  final sign = m.isNegative ? '−' : (signed && m.paisa > 0 ? '+' : '');
  return '$sign${showSymbol ? '৳ ' : ''}$body';
}
