import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/l10n/l10n_x.dart';
import '../../../core/money/money.dart';
import '../../../core/money/money_format.dart';
import '../../../core/money/numeral_style_provider.dart';
import '../../../core/speech/bangla_words.dart';
import '../../../core/theme/tokens.dart';
import '../../../data/database/database.dart';
import '../../../presentation/providers/auth_provider.dart';
import '../../../ui/category_icon.dart';
import '../../transactions/state/add_expense_controller.dart';

/// What A4 needs to show its top strip and to know which categories to offer.
class CategoryPickerArgs {
  const CategoryPickerArgs({
    required this.amountPaisa,
    this.caption = '',
    this.kind = 'expense',
    this.suggestedId,
    this.initialId,
  });

  final int amountPaisa;

  /// Account and date line, for example "ক্যাশ · আজ".
  final String caption;
  final String kind;

  /// The AI's suggestion. When the person picks another one, the caller starts the
  /// rule-learning prompt after saving (T-MOB-61).
  final String? suggestedId;
  final String? initialId;
}

/// A4 · pick a category by picture (route `/add/category`). Board: Picker.dc.html.
/// Pops with the chosen [CachedCategory].
class CategoryPickerScreen extends ConsumerStatefulWidget {
  const CategoryPickerScreen({super.key, required this.args});

  final CategoryPickerArgs args;

  @override
  ConsumerState<CategoryPickerScreen> createState() => _PickerState();
}

class _PickerState extends ConsumerState<CategoryPickerScreen> {
  String? _selectedId;

  @override
  void initState() {
    super.initState();
    _selectedId = widget.args.initialId;
  }

  void _select(CachedCategory c) {
    setState(() => _selectedId = c.id);
    ref.read(voiceServiceProvider).speak(c.nameBn);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final a = widget.args;
    final numerals = ref.watch(numeralStyleProvider);
    final all = ref.watch(addCategoriesProvider).valueOrNull ??
        const <CachedCategory>[];
    final cats = [
      for (final c in all)
        if (!c.isHidden && c.kind == a.kind) c,
    ];
    CachedCategory? selected;
    for (final c in cats) {
      if (c.id == _selectedId) selected = c;
    }
    final words = amountInWords(a.amountPaisa);
    final spoken = a.caption.isEmpty ? words : '$words · ${a.caption}';
    final amount = formatMoney(Money(a.amountPaisa), style: numerals);
    void speakStrip() => ref.read(voiceServiceProvider).speak(spoken);

    return Scaffold(
      backgroundColor: AppTokens.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                decoration: BoxDecoration(
                  color: AppTokens.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppTokens.border),
                ),
                child: Row(
                  children: [
                    Text(
                      amount,
                      key: const Key('picker_amount'),
                      style: const TextStyle(
                        fontSize: 34,
                        fontWeight: FontWeight.w700,
                        color: AppTokens.green,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        spoken,
                        style: const TextStyle(
                          fontSize: 15,
                          color: AppTokens.muted,
                        ),
                      ),
                    ),
                    Semantics(
                      button: true,
                      label: l10n.entry_picker_listen,
                      excludeSemantics: true,
                      onTap: speakStrip,
                      child: Material(
                        color: AppTokens.greenTint,
                        shape: const CircleBorder(),
                        child: InkWell(
                          key: const Key('picker_listen'),
                          customBorder: const CircleBorder(),
                          onTap: speakStrip,
                          child: const SizedBox(
                            width: 56,
                            height: 56,
                            child: Icon(
                              Icons.volume_up,
                              size: 26,
                              color: AppTokens.green,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text(
                l10n.entry_picker_title,
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                l10n.entry_picker_hint,
                style: const TextStyle(fontSize: 15, color: AppTokens.muted),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: GridView.builder(
                  key: const Key('picker_grid'),
                  padding: const EdgeInsets.only(bottom: 8),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    mainAxisExtent: 104,
                  ),
                  itemCount: cats.length,
                  itemBuilder: (_, i) => _Cell(
                    category: cats[i],
                    selected: cats[i].id == _selectedId,
                    selectedLabel: l10n.entry_picker_selected,
                    onTap: () => _select(cats[i]),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 28, top: 8),
                child: SizedBox(
                  width: double.infinity,
                  height: 72,
                  child: FilledButton(
                    key: const Key('picker_confirm'),
                    onPressed:
                        selected == null ? null : () => context.pop(selected),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppTokens.green,
                      foregroundColor: AppTokens.white,
                      shape: const StadiumBorder(),
                      textStyle: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.check, size: 32),
                        const SizedBox(width: 10),
                        Flexible(
                          child: Text(
                            l10n.entry_picker_confirm(selected?.nameBn ?? ''),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({
    required this.category,
    required this.selected,
    required this.selectedLabel,
    required this.onTap,
  });

  final CachedCategory category;
  final bool selected;
  final String selectedLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = selected ? AppTokens.green : AppTokens.ink;
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(22),
      side: BorderSide(
        color: selected ? AppTokens.green : AppTokens.inputBorder,
        width: selected ? 3 : 2,
      ),
    );
    return Semantics(
      button: true,
      selected: selected,
      label: category.nameBn,
      value: selected ? selectedLabel : null,
      excludeSemantics: true,
      onTap: onTap,
      child: Material(
        color: selected ? AppTokens.greenTint : AppTokens.white,
        shape: shape,
        child: InkWell(
          key: Key('pick_${category.id}'),
          customBorder: shape,
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                CategoryIcon(category.key, size: 36, color: fg),
                const SizedBox(height: 6),
                Text(
                  selected ? '✓ ${category.nameBn}' : category.nameBn,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    height: 1.2,
                    color: fg,
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
