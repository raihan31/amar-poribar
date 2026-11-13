import 'package:flutter/material.dart';

import 'txn_row.dart';

/// A filter pill: 48 dp tall; the chosen one is green-tinted with a green border and a tick.
class FilterPill extends StatelessWidget {
  const FilterPill({
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
    final p = ListPalette.of(context);
    final fg = selected ? p.green : p.ink;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      onTap: onTap,
      child: Material(
        color: selected ? p.greenTint : p.surface,
        shape: StadiumBorder(
          side: BorderSide(color: selected ? p.green : p.border, width: 2),
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
                    Icon(Icons.check, size: 18, color: p.green),
                    const SizedBox(width: 4),
                  ],
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 15,
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

/// One option of [FilterChips].
class FilterOption {
  const FilterOption(this.label, this.selected, this.onTap);

  final String label;
  final bool selected;
  final VoidCallback onTap;
}

/// A horizontally scrolling row of [FilterPill]s.
class FilterChips extends StatelessWidget {
  const FilterChips({super.key, required this.options});

  final List<FilterOption> options;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
        child: Row(
          children: [
            for (var i = 0; i < options.length; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              FilterPill(
                label: options[i].label,
                selected: options[i].selected,
                onTap: options[i].onTap,
              ),
            ],
          ],
        ),
      );
}
