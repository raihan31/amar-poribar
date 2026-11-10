import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';

enum BannerKind { warn, error }

/// Full-width notice strip (offline, sync problem). Board: Home.dc.html.
class BannerStrip extends StatelessWidget {
  const BannerStrip({
    super.key,
    required this.kind,
    required this.text,
    this.actionLabel,
    this.onAction,
  });

  final BannerKind kind;
  final String text;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final warn = kind == BannerKind.warn;
    final bg = warn ? AppTokens.amberTint : AppTokens.dangerTint;
    final fg = warn ? AppTokens.amberInk : AppTokens.dangerInk;
    return Container(
      width: double.infinity,
      color: bg,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Icon(
            warn ? Icons.warning_amber_rounded : Icons.error,
            size: 24,
            color: fg,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: fg,
              ),
            ),
          ),
          if (actionLabel != null)
            TextButton(
              onPressed: onAction,
              style: TextButton.styleFrom(
                minimumSize: const Size(48, 48),
                foregroundColor: fg,
              ),
              child: Text(
                actionLabel!,
                style:
                    const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
            ),
        ],
      ),
    );
  }
}
