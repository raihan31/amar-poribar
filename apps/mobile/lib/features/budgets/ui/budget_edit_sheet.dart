import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/l10n/l10n_x.dart';
import '../../../core/money/money.dart';
import '../../../core/money/money_format.dart';
import '../../../core/money/numeral_style_provider.dart';
import '../../../core/theme/tokens.dart';
import '../../../ui/big_button.dart';
import '../../home/state/home_providers.dart';
import '../../transactions/widgets/amount_keypad.dart';
import '../data/budget_repository.dart';

/// "+ বাজেট দিন": pick the overall budget or a category, type the amount on the big keypad, save.
/// Pops with a [BudgetInput].
Future<BudgetInput?> showBudgetEditSheet(BuildContext context) =>
    showModalBottomSheet<BudgetInput>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => const BudgetEditSheet(),
    );

class BudgetEditSheet extends ConsumerStatefulWidget {
  const BudgetEditSheet({super.key});

  @override
  ConsumerState<BudgetEditSheet> createState() => _BudgetEditSheetState();
}

class _BudgetEditSheetState extends ConsumerState<BudgetEditSheet> {
  String? _categoryId; // null = the whole family
  String _digits = '';

  static const _maxDigits = 9;

  void _type(String d) {
    final next = (_digits + d).replaceFirst(RegExp('^0+'), '');
    if (next.length > _maxDigits) return;
    setState(() => _digits = next);
  }

  void _back() {
    if (_digits.isEmpty) return;
    setState(() => _digits = _digits.substring(0, _digits.length - 1));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final style = ref.watch(numeralStyleProvider);
    final names = ref.watch(categoryNamesProvider).valueOrNull ?? const {};
    final taka = _digits.isEmpty ? 0 : int.parse(_digits);
    final scheme = Theme.of(context).colorScheme;

    Widget chip(String label, String? id) => ChoiceChip(
      label: Text(label, style: const TextStyle(fontSize: 16)),
      selected: _categoryId == id,
      onSelected: (_) => setState(() => _categoryId = id),
      materialTapTargetSize: MaterialTapTargetSize.padded,
      visualDensity: VisualDensity.comfortable,
      selectedColor: AppTokens.greenTint,
    );

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.budget_editTitle,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(
              l10n.budget_pickCategory,
              style: TextStyle(fontSize: 15, color: scheme.onSurfaceVariant),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                chip(l10n.budget_overall, null),
                for (final e in names.entries) chip(e.value, e.key),
              ],
            ),
            const SizedBox(height: 12),
            Center(
              child: Text(
                formatMoney(Money.fromTaka(taka), style: style),
                key: const ValueKey('budget-amount'),
                style: const TextStyle(
                  fontSize: 36,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(height: 12),
            AmountKeypad(style: style, onDigits: _type, onBackspace: _back),
            const SizedBox(height: 12),
            BigButton(
              label: l10n.budget_save,
              onPressed: taka <= 0
                  ? null
                  : () => Navigator.pop(
                      context,
                      BudgetInput(_categoryId, Money.fromTaka(taka).paisa),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
