import 'dart:convert';
import 'dart:io';

import 'package:amar_poribar/core/money/money.dart';
import 'package:amar_poribar/core/money/money_format.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final vectors = (jsonDecode(
    File('../../packages/shared/test-vectors/money.json').readAsStringSync(),
  ) as List)
      .cast<Map<String, dynamic>>();

  test('all vectors in both styles', () {
    expect(vectors, isNotEmpty);
    for (final v in vectors) {
      final m = Money(v['paisa'] as int);
      expect(formatMoney(m, style: NumeralStyle.bangla), v['bn']);
      expect(formatMoney(m, style: NumeralStyle.latin), v['en']);
    }
  });

  test('options', () {
    expect(
      formatMoney(
        const Money(85000),
        style: NumeralStyle.latin,
        showSymbol: false,
      ),
      '850',
    );
    expect(
      formatMoney(const Money(85000), style: NumeralStyle.latin, signed: true),
      '+৳ 850',
    );
    expect(
      formatMoney(const Money(-5), style: NumeralStyle.latin),
      '−৳ 0.05',
    );
  });

  test('toBanglaDigits', () {
    expect(toBanglaDigits('1,25,000.50 ab'), '১,২৫,০০০.৫০ ab');
  });
}
