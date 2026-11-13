import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/money/money.dart';
import '../core/money/money_format.dart';
import '../core/money/numeral_style_provider.dart';
import '../core/theme/tokens.dart';

enum AmountStyle { normal, big, income, expense }

/// A money amount in the user's numeral style. Board: Home.dc.html (balance).
class AmountText extends ConsumerWidget {
  const AmountText(this.money, {super.key, this.style = AmountStyle.normal});

  final Money money;
  final AmountStyle style;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final numerals = ref.watch(numeralStyleProvider);
    final signed = style == AmountStyle.income;
    final text = formatMoney(money, style: numerals, signed: signed);
    final (size, color) = switch (style) {
      AmountStyle.normal => (20.0, AppTokens.ink),
      AmountStyle.big => (34.0, AppTokens.ink),
      AmountStyle.income => (20.0, AppTokens.green),
      AmountStyle.expense => (20.0, AppTokens.danger),
    };
    return Text(
      text,
      style: TextStyle(
        fontSize: size,
        fontWeight: FontWeight.w700,
        color: color,
      ),
    );
  }
}
