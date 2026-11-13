import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/tokens.dart';
import '../core/theme/ui_scale.dart';

/// Rounded tile with a big icon and label. Board: Home.dc.html, Simple mode home.
class IconTile extends ConsumerWidget {
  const IconTile({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  static const double radius = 22;
  static const double iconSize = 30;
  static const double labelSize = 17;
  static const double normalHeight = 84;
  static const double simpleHeight = 112;

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final simple = ref.watch(uiScaleProvider) == UiScale.simple;
    return Semantics(
      container: true,
      button: true,
      label: label,
      excludeSemantics: true,
      onTap: onTap,
      child: Material(
        color: AppTokens.greenTint,
        borderRadius: BorderRadius.circular(radius),
        child: InkWell(
          borderRadius: BorderRadius.circular(radius),
          onTap: onTap,
          child: SizedBox(
            height: simple ? simpleHeight : normalHeight,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: iconSize, color: AppTokens.deepGreen),
                const SizedBox(height: 6),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: labelSize,
                    fontWeight: FontWeight.w700,
                    color: AppTokens.deepGreen,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
