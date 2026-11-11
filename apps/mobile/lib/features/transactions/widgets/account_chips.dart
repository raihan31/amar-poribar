import 'package:flutter/material.dart';

import '../../../core/theme/tokens.dart';

/// One pill in a chip row. The selected one is green-tinted with a tick, never colour alone.
class ChoicePill extends StatelessWidget {
  const ChoicePill({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = selected ? AppTokens.green : AppTokens.ink;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      onTap: onTap,
      child: Material(
        color: selected ? AppTokens.greenTint : AppTokens.white,
        shape: StadiumBorder(
          side: BorderSide(
            color: selected ? AppTokens.green : AppTokens.inputBorder,
            width: selected ? 3 : 2,
          ),
        ),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (selected) ...[
                    const Icon(Icons.check, size: 18, color: AppTokens.green),
                    const SizedBox(width: 4),
                  ],
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                      color: fg,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Account chips (FR-ACC-01), from the cached non-archived accounts.
class AccountChips extends StatelessWidget {
  const AccountChips({
    super.key,
    required this.accounts,
    required this.selectedId,
    required this.onSelected,
  });

  /// (id, display name).
  final List<({String id, String name})> accounts;
  final String? selectedId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) => Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final a in accounts)
            ChoicePill(
              label: a.name,
              selected: a.id == selectedId,
              onTap: () => onSelected(a.id),
            ),
        ],
      );
}
