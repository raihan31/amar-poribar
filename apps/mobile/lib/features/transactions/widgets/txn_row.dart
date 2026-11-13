import 'package:flutter/material.dart';

import '../../../core/theme/dark_tokens.dart';
import '../../../core/theme/tokens.dart';

/// Colours of the list for the current brightness.
class ListPalette {
  const ListPalette._({
    required this.bg,
    required this.ink,
    required this.muted,
    required this.green,
    required this.greenTint,
    required this.surface,
    required this.border,
    required this.danger,
    required this.lockTile,
  });

  final Color bg;
  final Color ink;
  final Color muted;
  final Color green;
  final Color greenTint;
  final Color surface;
  final Color border;
  final Color danger;
  final Color lockTile;

  static const _light = ListPalette._(
    bg: AppTokens.bg,
    ink: AppTokens.ink,
    muted: AppTokens.muted,
    green: AppTokens.green,
    greenTint: AppTokens.greenTint,
    surface: AppTokens.white,
    border: AppTokens.inputBorder,
    danger: AppTokens.danger,
    lockTile: Color(0xFFF1E6D3),
  );

  static const _dark = ListPalette._(
    bg: DarkTokens.bg,
    ink: DarkTokens.ink,
    muted: DarkTokens.muted,
    green: DarkTokens.green,
    greenTint: DarkTokens.greenTint,
    surface: DarkTokens.surface,
    border: DarkTokens.border,
    danger: DarkTokens.danger,
    lockTile: DarkTokens.border,
  );

  static ListPalette of(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark ? _dark : _light;
}

/// Tile colours by category: a stable pick from the board's pastel pairs.
const List<(Color, Color)> _tilePairs = [
  (AppTokens.amberTint, AppTokens.amberInk),
  (Color(0xFFCDE8C8), AppTokens.green),
  (Color(0xFFBFD8F2), Color(0xFF173F6B)),
  (Color(0xFFE3D2F2), Color(0xFF4A2670)),
  (Color(0xFFF4C7B8), Color(0xFF7A2E14)),
];

(Color, Color) tilePair(String? seed) {
  final n = (seed ?? '').codeUnits.fold<int>(0, (a, b) => a + b);
  return _tilePairs[n % _tilePairs.length];
}

/// The amount as the row shows it, and which way it goes.
enum TxnDirection { expense, income, neutral }

/// One entry of the list. Board: Txns.dc.html.
class TxnRow extends StatelessWidget {
  const TxnRow({
    super.key,
    required this.title,
    required this.subtitle,
    required this.amount,
    required this.direction,
    required this.categoryKey,
    required this.isPrivate,
    required this.onTap,
  });

  final String title;
  final String subtitle;

  /// Already formatted with sign and digits.
  final String amount;
  final TxnDirection direction;
  final String? categoryKey;
  final bool isPrivate;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = ListPalette.of(context);
    final amountColor = switch (direction) {
      TxnDirection.expense => p.danger,
      TxnDirection.income => p.green,
      TxnDirection.neutral => p.ink,
    };
    final (tileBg, tileFg) = tilePair(categoryKey ?? title);
    final initial = title.isEmpty ? '' : String.fromCharCode(title.runes.first);
    return InkWell(
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: 72),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: p.border.withAlpha(120))),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isPrivate ? p.lockTile : tileBg,
                borderRadius: BorderRadius.circular(16),
              ),
              child: isPrivate
                  ? Icon(Icons.lock_outline, size: 24, color: p.muted)
                  : Text(
                      initial,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: tileFg,
                      ),
                    ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: p.ink,
                    ),
                  ),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 14, color: p.muted),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Text(
              amount,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: amountColor,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
