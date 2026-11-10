import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';
import 'big_button.dart';

/// Bottom sheet explaining why a permission is needed (used by T-MOB-72).
/// Board: Permissions.dc.html.
class PermissionExplainer extends StatelessWidget {
  const PermissionExplainer({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
    required this.allowLabel,
    required this.onAllow,
    this.laterLabel = 'পরে',
    this.onLater,
  });

  final IconData icon;
  final String title;
  final String body;
  final String allowLabel;
  final VoidCallback onAllow;
  final String laterLabel;
  final VoidCallback? onLater;

  /// Shows the explainer as a modal bottom sheet.
  static Future<T?> show<T>(BuildContext context, PermissionExplainer sheet) =>
      showModalBottomSheet<T>(
        context: context,
        backgroundColor: AppTokens.bg,
        isScrollControlled: true,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppTokens.radiusCard),
          ),
        ),
        builder: (_) => sheet,
      );

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 56, color: AppTokens.green),
            const SizedBox(height: 12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: AppTokens.ink,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              body,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 18, color: AppTokens.muted),
            ),
            const SizedBox(height: 20),
            BigButton(label: allowLabel, onPressed: onAllow),
            const SizedBox(height: 10),
            BigButton(
              label: laterLabel,
              style: BigButtonStyle.quiet,
              onPressed: onLater ?? () => Navigator.maybePop(context),
            ),
          ],
        ),
      ),
    );
  }
}
