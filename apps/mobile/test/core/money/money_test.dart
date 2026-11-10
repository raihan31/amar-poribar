import 'package:amar_poribar/core/money/money.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('fromTaka converts to paisa', () {
    expect(Money.fromTaka(850).paisa, 85000);
  });
  test('arithmetic', () {
    expect(const Money(100) + const Money(250), const Money(350));
    expect(const Money(100) - const Money(250), const Money(-150));
    expect(-const Money(100), const Money(-100));
    expect((const Money(100) - const Money(250)).isNegative, isTrue);
    expect(Money.zero.isNegative, isFalse);
  });
  test('equality, hashCode and ordering', () {
    expect(const Money(5) == const Money(5), isTrue);
    expect(const Money(5).hashCode, const Money(5).hashCode);
    expect(const Money(5).compareTo(const Money(9)), lessThan(0));
    expect(const Money(9).compareTo(const Money(5)), greaterThan(0));
  });
}
