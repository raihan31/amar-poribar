import 'package:flutter/material.dart';

import '../../../core/l10n/l10n_x.dart';
import '../../../core/money/money_format.dart';
import '../../../core/speech/budget_alerts.dart';
import '../../../core/theme/tokens.dart';

/// Words for the status of [b], for example "ঠিক আছে" (FR-BUD-07: never colour alone).
String budgetStatusText(
  BuildContext context,
  BudgetStatus b,
  NumeralStyle style,
) {
  final l10n = context.l10n;
  switch (b.level) {
    case 'exceeded':
      return l10n.budget_statusExceeded(
        formatMoney(b.spent - b.limit, style: style),
      );
    case 'warning':
      final p = b.limitPaisa <= 0 ? 0 : b.spentPaisa * 100 ~/ b.limitPaisa;
      return l10n.budget_statusWarning(
        style == NumeralStyle.bangla ? toBanglaDigits('$p') : '$p',
      );
    default:
      return l10n.budget_statusOk;
  }
}

/// One budget: title, "৳ spent / limit", a 14 dp bar and a status row with icon and words.
/// Board: Budgets.dc.html.
class BudgetCard extends StatelessWidget {
  const BudgetCard({
    super.key,
    required this.budget,
    required this.style,
    this.buzzLabel,
    this.onBuzz,
  });

  final BudgetStatus budget;
  final NumeralStyle style;

  /// "আম্মুকে কম্পন দিন"; shown on an exceeded card when [onBuzz] is set.
  final String? buzzLabel;
  final VoidCallback? onBuzz;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final overall = budget.categoryId == null;
    final exceeded = budget.level == 'exceeded';
    final warning = budget.level == 'warning';

    final border = exceeded
        ? AppTokens.danger
        : overall
        ? (dark ? AppTokens.statusOk : AppTokens.green)
        : scheme.outlineVariant;
    final barColor = exceeded
        ? AppTokens.danger
        : warning
        ? AppTokens.amber
        : AppTokens.statusOk;
    final ink = exceeded
        ? (dark ? AppTokens.dangerTint : AppTokens.danger)
        : warning
        ? (dark ? AppTokens.amber : AppTokens.amberInk)
        : (dark ? AppTokens.greenTint : AppTokens.deepGreen);
    final icon = exceeded
        ? Icons.error_outline
        : warning
        ? Icons.warning_amber_rounded
        : Icons.check;
    final ratio = budget.limitPaisa <= 0
        ? 0.0
        : (budget.spentPaisa / budget.limitPaisa).clamp(0.0, 1.0);
    final title = overall ? l10n.budget_overall : budget.nameBn;
    final amounts =
        '${formatMoney(budget.spent, style: style)} / '
        '${formatMoney(budget.limit, style: style, showSymbol: false)}';
    final status = budgetStatusText(context, budget, style);

    return Container(
      key: ValueKey('budget-${budget.categoryId ?? 'overall'}'),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: border, width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                amounts,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(7),
            child: SizedBox(
              height: 14,
              child: Stack(
                children: [
                  Positioned.fill(
                    child: ColoredBox(color: scheme.outlineVariant),
                  ),
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: FractionallySizedBox(
                      widthFactor: ratio,
                      heightFactor: 1,
                      child: ColoredBox(color: barColor),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(icon, size: 22, color: ink),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  status,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: ink,
                  ),
                ),
              ),
              if (exceeded && onBuzz != null && buzzLabel != null) ...[
                const Spacer(),
                Semantics(
                  button: true,
                  label: buzzLabel,
                  excludeSemantics: true,
                  onTap: onBuzz,
                  child: Material(
                    color: AppTokens.amber,
                    shape: const StadiumBorder(),
                    child: InkWell(
                      customBorder: const StadiumBorder(),
                      onTap: onBuzz,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(minHeight: 48),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          child: Center(
                            widthFactor: 1,
                            child: Text(
                              buzzLabel!,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: AppTokens.ink,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
