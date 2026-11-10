import 'package:amar_poribar/core/money/money.dart';
import 'package:amar_poribar/core/money/parse_taka.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses Bangla and Latin input', () {
    expect(parseTakaInput('৮৫০'), Money.fromTaka(850));
    expect(parseTakaInput('1,25,000'), Money.fromTaka(125000));
    expect(parseTakaInput('৳ ৯৯'), Money.fromTaka(99));
    expect(parseTakaInput('12.5'), const Money(1250));
    expect(parseTakaInput('1.50'), const Money(150));
  });
  test('rejects junk', () {
    expect(parseTakaInput('abc'), isNull);
    expect(parseTakaInput(''), isNull);
    expect(parseTakaInput('৳'), isNull);
    expect(parseTakaInput('1.234'), isNull);
    expect(parseTakaInput('1.2.3'), isNull);
  });
}
