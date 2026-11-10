import 'package:amar_poribar/core/money/money.dart';
import 'package:amar_poribar/core/money/money_format.dart';
import 'package:amar_poribar/core/money/numeral_style_provider.dart';
import 'package:amar_poribar/ui/amount_text.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _app(Widget c, {NumeralStyle s = NumeralStyle.bangla}) => ProviderScope(
      overrides: [numeralStyleProvider.overrideWith((ref) => s)],
      child: MaterialApp(home: Scaffold(body: c)),
    );

void main() {
  testWidgets('Bangla numerals', (t) async {
    await t.pumpWidget(_app(const AmountText(Money(12500000))));
    expect(find.text('৳ ১,২৫,০০০'), findsOneWidget);
  });

  testWidgets('Latin numerals', (t) async {
    await t.pumpWidget(
      _app(const AmountText(Money(12500000)), s: NumeralStyle.latin),
    );
    expect(find.text('৳ 1,25,000'), findsOneWidget);
  });

  testWidgets('negative shows minus', (t) async {
    await t.pumpWidget(_app(const AmountText(Money(-50000))));
    expect(find.text('−৳ ৫০০'), findsOneWidget);
  });

  testWidgets('income shows plus', (t) async {
    await t.pumpWidget(
      _app(const AmountText(Money(50000), style: AmountStyle.income)),
    );
    expect(find.text('+৳ ৫০০'), findsOneWidget);
  });
}
