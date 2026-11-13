import 'package:flutter/material.dart';

import '../../../core/theme/tokens.dart';
import '../../../data/database/database.dart';
import '../../../ui/category_icon.dart';

/// Wrapping row of category tiles (icon above the Bangla name).
class CategoryIconRow extends StatelessWidget {
  const CategoryIconRow({
    super.key,
    required this.categories,
    required this.selectedId,
    required this.onSelected,
  });

  final List<CachedCategory> categories;
  final String? selectedId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final c in categories)
          _Tile(
            category: c,
            selected: c.id == selectedId,
            onTap: () => onSelected(c.id),
          ),
      ],
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.category,
    required this.selected,
    required this.onTap,
  });

  final CachedCategory category;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = selected ? AppTokens.green : AppTokens.ink;
    return Semantics(
      button: true,
      selected: selected,
      label: category.nameBn,
      excludeSemantics: true,
      onTap: onTap,
      child: Material(
        color: selected ? AppTokens.greenTint : AppTokens.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(
            color: selected ? AppTokens.green : AppTokens.inputBorder,
            width: selected ? 3 : 2,
          ),
        ),
        child: InkWell(
          key: Key('cat_${category.id}'),
          customBorder: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 76, minHeight: 80),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CategoryIcon(category.key, color: fg),
                  const SizedBox(height: 2),
                  Text(
                    category.nameBn,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
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
