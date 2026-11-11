import 'package:flutter/material.dart';

import '../../../core/l10n/l10n_x.dart';
import '../../../core/money/money_format.dart';
import '../../../core/theme/tokens.dart';

/// Custom 3x4 number pad (D4). Keys are 64 dp; digits follow the numeral style.
class AmountKeypad extends StatelessWidget {
  const AmountKeypad({
    super.key,
    required this.style,
    required this.onDigits,
    required this.onBackspace,
  });

  static const double keyHeight = 64;

  final NumeralStyle style;

  /// Called with `'0'..'9'` or `'00'` (always Latin digits).
  final void Function(String digits) onDigits;
  final VoidCallback onBackspace;

  String _show(String d) =>
      style == NumeralStyle.bangla ? toBanglaDigits(d) : d;

  Widget _key(Widget child, String label, VoidCallback onTap, Key key) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 3),
        child: Semantics(
          button: true,
          label: label,
          excludeSemantics: true,
          onTap: onTap,
          child: Material(
            color: AppTokens.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: AppTokens.inputBorder, width: 2),
            ),
            child: InkWell(
              key: key,
              customBorder: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              onTap: onTap,
              child: SizedBox(
                height: keyHeight,
                child: Center(child: child),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _digit(String d) => _key(
        Text(
          _show(d),
          style: const TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.w600,
            color: AppTokens.ink,
          ),
        ),
        _show(d),
        () => onDigits(d),
        Key('key_$d'),
      );

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(children: [_digit('1'), _digit('2'), _digit('3')]),
        Row(children: [_digit('4'), _digit('5'), _digit('6')]),
        Row(children: [_digit('7'), _digit('8'), _digit('9')]),
        Row(
          children: [
            _digit('00'),
            _digit('0'),
            _key(
              const Icon(
                Icons.backspace_outlined,
                size: 28,
                color: AppTokens.ink,
              ),
              context.l10n.txn_add_backspace,
              onBackspace,
              const Key('key_back'),
            ),
          ],
        ),
      ],
    );
  }
}
