import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/redirects.dart';
import '../../../core/l10n/l10n_x.dart';
import '../../../core/money/money.dart';
import '../../../core/money/money_format.dart';
import '../../../core/money/numeral_style_provider.dart';
import '../../../core/theme/tokens.dart';
import '../../../presentation/providers/auth_provider.dart';
import '../../../ui/big_button.dart';
import '../../../ui/empty_state.dart';
import '../../home/state/home_providers.dart';
import '../data/budget_repository.dart';
import '../state/budget_providers.dart';
import '../widgets/budget_card.dart';
import 'budget_edit_sheet.dart';

const _months = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

String _num(NumeralStyle style, Object n) =>
    style == NumeralStyle.bangla ? toBanglaDigits('$n') : '$n';

/// "১৫ – ২০ জুন" or "২৮ জুন – ২ জুলাই" from two `YYYY-MM-DD` days.
String festivalRange(String startsOn, String endsOn, NumeralStyle style) {
  final a = DateTime.tryParse(startsOn);
  final b = DateTime.tryParse(endsOn);
  if (a == null || b == null) return '$startsOn – $endsOn';
  if (a.month == b.month) {
    return '${_num(style, a.day)} – ${_num(style, b.day)} ${_months[a.month - 1]}';
  }
  return '${_num(style, a.day)} ${_months[a.month - 1]} – '
      '${_num(style, b.day)} ${_months[b.month - 1]}';
}

/// B3: the month's budgets with colour, icon and words; spoken alerts; Owner/Admin edit.
/// Board: Budgets.dc.html. Route `/budget` (tab 3).
class BudgetsScreen extends ConsumerStatefulWidget {
  const BudgetsScreen({super.key});

  @override
  ConsumerState<BudgetsScreen> createState() => _BudgetsScreenState();
}

class _BudgetsScreenState extends ConsumerState<BudgetsScreen> {
  @override
  void initState() {
    super.initState();
    // Send edits that were made offline.
    Future.microtask(() async {
      try {
        await ref.read(budgetRepositoryProvider).flushQueued();
      } catch (_) {}
    });
  }

  Future<void> _add() async {
    final input = await showBudgetEditSheet(context);
    if (input == null || !mounted) return;
    final l10n = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    try {
      final sent = await ref.read(budgetRepositoryProvider).put([input]);
      if (!sent) {
        messenger.showSnackBar(SnackBar(content: Text(l10n.budget_queued)));
      }
    } catch (_) {
      messenger.showSnackBar(SnackBar(content: Text(l10n.budget_saveFailed)));
    }
  }

  Future<void> _listen(List<BudgetStatus> budgets) async {
    final allOk = context.l10n.budget_allOk;
    final spoken = await ref.read(spokenAlertControllerProvider).speakAll();
    if (spoken == 0) {
      await ref.read(voiceServiceProvider).speak(allOk);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final style = ref.watch(numeralStyleProvider);
    final budgets = ref.watch(budgetStatusesProvider).valueOrNull ?? const [];
    final festivals =
        ref.watch(festivalBudgetsProvider).valueOrNull ?? const [];
    final canEdit = ref.watch(canEditBudgetsProvider);
    final recipient = ref.watch(budgetRecipientProvider);
    final month = ref.watch(homeMonthProvider); // YYYY-MM
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final monthName =
        '${_months[int.parse(month.substring(5, 7)) - 1]} ${_num(style, month.substring(0, 4))}';

    VoidCallback? buzz() {
      if (recipient == null) return null;
      return () => context.push(
            Uri(
              path: Routes.buzz,
              queryParameters: {'phrase': 'বাজেট শেষ', 'to': recipient.userId},
            ).toString(),
          );
    }

    final listen = _ListenButton(
      label: l10n.budget_listen,
      onTap: () => unawaited(_listen(budgets)),
    );

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 28, 20, 12),
                children: [
                  Text(
                    l10n.budget_title,
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w700,
                      color: dark ? AppTokens.greenTint : AppTokens.green,
                    ),
                  ),
                  Text(
                    l10n.budget_subtitle(monthName),
                    style: TextStyle(
                      fontSize: 15,
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 14),
                  if (budgets.isEmpty)
                    SizedBox(
                      height: 260,
                      child: EmptyState(
                        icon: Icons.pie_chart_outline,
                        message: l10n.budget_empty,
                        speakHint: false,
                      ),
                    ),
                  for (final b in budgets) ...[
                    BudgetCard(
                      budget: b,
                      style: style,
                      buzzLabel: recipient == null
                          ? null
                          : l10n.budget_buzz(recipient.name),
                      onBuzz: buzz(),
                    ),
                    const SizedBox(height: 10),
                  ],
                  for (final f in festivals) ...[
                    _FestivalCard(festival: f, style: style),
                    const SizedBox(height: 10),
                  ],
                  if (canEdit)
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: TextButton(
                        onPressed: () => context.push(Routes.festivalNew),
                        style: TextButton.styleFrom(
                          minimumSize: const Size(48, 48),
                        ),
                        child: Text(
                          l10n.budget_festivalNew,
                          style: const TextStyle(fontSize: 16),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
              child: Row(
                children: [
                  if (canEdit) ...[
                    Expanded(
                      child: BigButton(
                        label: l10n.budget_add,
                        height: 64,
                        onPressed: _add,
                      ),
                    ),
                    const SizedBox(width: 10),
                  ],
                  if (canEdit)
                    SizedBox(width: 72, child: listen)
                  else
                    Expanded(child: listen),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ListenButton extends StatelessWidget {
  const _ListenButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      onTap: onTap,
      child: Material(
        color: AppTokens.amber,
        shape: const StadiumBorder(),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: onTap,
          child: const SizedBox(
            height: 64,
            child: Icon(Icons.volume_up, size: 30, color: AppTokens.ink),
          ),
        ),
      ),
    );
  }
}

class _FestivalCard extends StatelessWidget {
  const _FestivalCard({required this.festival, required this.style});

  final FestivalBudget festival;
  final NumeralStyle style;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: scheme.outlineVariant, width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.budget_festivalTitle(festival.name),
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            l10n.budget_festivalLine(
              festivalRange(festival.startsOn, festival.endsOn, style),
              formatMoney(Money(festival.limitPaisa), style: style),
            ),
            style: TextStyle(fontSize: 15, color: scheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}
