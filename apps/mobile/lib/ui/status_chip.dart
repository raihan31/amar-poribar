import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';

enum StatusKind { ok, warn, bad, neutral }

/// Status pill, always icon plus text (FR-A11Y-02). Board: Budget.dc.html.
class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.kind, required this.label});

  final StatusKind kind;
  final String label;

  static IconData iconFor(StatusKind k) => switch (k) {
        StatusKind.ok => Icons.check_circle,
        StatusKind.warn => Icons.warning_amber_rounded,
        StatusKind.bad => Icons.error,
        StatusKind.neutral => Icons.info_outline,
      };

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (kind) {
      StatusKind.ok => (AppTokens.greenTint, AppTokens.deepGreen),
      StatusKind.warn => (AppTokens.amberTint, AppTokens.amberInk),
      StatusKind.bad => (AppTokens.dangerTint, AppTokens.dangerInk),
      StatusKind.neutral => (AppTokens.border, AppTokens.ink),
    };
    return Semantics(
      label: label,
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(AppTokens.radiusPill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(iconFor(kind), size: 18, color: fg),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: fg,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
