import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';
import 'big_button.dart';

/// Friendly empty list placeholder. Board: Shopping.dc.html (empty list).
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.message,
    this.actionLabel,
    this.onAction,
    this.speakHint = true,
  });

  static const double iconSize = 64;
  static const String speakHintText = 'মাইক চেপে বলুন';

  final IconData icon;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool speakHint;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: iconSize, color: AppTokens.muted),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w600,
                color: AppTokens.ink,
              ),
            ),
            if (speakHint) ...[
              const SizedBox(height: 8),
              const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.mic, size: 20, color: AppTokens.muted),
                  SizedBox(width: 6),
                  Text(
                    speakHintText,
                    style: TextStyle(fontSize: 16, color: AppTokens.muted),
                  ),
                ],
              ),
            ],
            if (actionLabel != null) ...[
              const SizedBox(height: 20),
              BigButton(label: actionLabel!, onPressed: onAction),
            ],
          ],
        ),
      ),
    );
  }
}
