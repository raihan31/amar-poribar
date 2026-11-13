import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/tokens.dart';
import '../core/theme/ui_scale.dart';

enum BigButtonStyle { primary, amber, outline, danger, quiet }

/// Big pill button used on every screen. Board: Home.dc.html (primary actions).
class BigButton extends ConsumerWidget {
  const BigButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.style = BigButtonStyle.primary,
    this.height,
  });

  static const double labelSize = 18;
  static const double iconSize = 24;

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final BigButtonStyle style;
  final double? height;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final h = height ?? ref.watch(uiScaleProvider).primaryHeight;
    final (bg, fg, border) = switch (style) {
      BigButtonStyle.primary => (AppTokens.green, AppTokens.white, null),
      BigButtonStyle.amber => (AppTokens.amber, AppTokens.ink, null),
      BigButtonStyle.outline => (
          AppTokens.white,
          AppTokens.green,
          AppTokens.green
        ),
      BigButtonStyle.danger => (AppTokens.danger, AppTokens.white, null),
      BigButtonStyle.quiet => (AppTokens.greenTint, AppTokens.deepGreen, null),
    };
    final enabled = onPressed != null;
    final isPrimary = style == BigButtonStyle.primary ||
        style == BigButtonStyle.amber ||
        style == BigButtonStyle.danger;
    return Semantics(
      container: true,
      identifier: isPrimary ? 'primary' : null,
      button: true,
      enabled: enabled,
      label: label,
      excludeSemantics: true,
      onTap: onPressed,
      child: Opacity(
        opacity: enabled ? 1 : 0.5,
        child: Material(
          color: bg,
          shape: StadiumBorder(
            side: border == null
                ? BorderSide.none
                : BorderSide(color: border, width: 2),
          ),
          child: InkWell(
            customBorder: const StadiumBorder(),
            onTap: onPressed,
            child: SizedBox(
              height: h,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (icon != null) ...[
                      Icon(icon, size: iconSize, color: fg),
                      const SizedBox(width: 10),
                    ],
                    Flexible(
                      child: Text(
                        label,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: labelSize,
                          fontWeight: FontWeight.w700,
                          color: fg,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
