import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/l10n/l10n_x.dart';
import '../../../core/money/money.dart';
import '../../../core/money/money_format.dart';
import '../../../core/money/numeral_style_provider.dart';
import '../../../core/speech/bangla_words.dart';
import '../../../core/speech/categories.dart';
import '../../../core/theme/tokens.dart';
import '../../../domain/models/api/draft.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../../ui/category_icon.dart';
import '../../transactions/data/transaction_repository.dart' show dayHeader;
import '../state/entry_controller.dart';

/// One proposed entry as a white card with a green border (board: VoiceEntry.dc.html). With
/// [compact] the card also carries its own 🔊 / ✓ / ✗ row, for the several-entries list (FR-VOICE-06).
class DraftCard extends ConsumerWidget {
  const DraftCard({
    super.key,
    required this.draft,
    this.compact = false,
    this.onListen,
    this.onYes,
    this.onNo,
    this.onPickCategory,
  });

  final TransactionDraft draft;
  final bool compact;
  final VoidCallback? onListen;
  final VoidCallback? onYes;
  final VoidCallback? onNo;
  final VoidCallback? onPickCategory;

  static String accountLabel(AppLocalizations l10n, String? type) =>
      switch (type) {
        'cash' => l10n.entry_acct_cash,
        'bkash' => l10n.entry_acct_bkash,
        'nagad' => l10n.entry_acct_nagad,
        'rocket' => l10n.entry_acct_rocket,
        'bank' => l10n.entry_acct_bank,
        _ => '',
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final numerals = ref.watch(numeralStyleProvider);
    final now = ref.watch(entryClockProvider)();
    final cat = categoryByKey(draft.categoryKey);
    final typeLabel = switch (draft.type) {
      'income' => l10n.entry_typeIncome,
      'transfer' => l10n.entry_typeTransfer,
      _ => l10n.entry_typeExpense,
    };
    final account = accountLabel(l10n, draft.accountType);
    final subtitle = [
      typeLabel,
      if (account.isNotEmpty) account,
      dayHeader(draft.occurredAt, now),
    ].join(' · ');

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTokens.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: AppTokens.green, width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: AppTokens.amberTint,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: CategoryIcon(
                  draft.categoryKey,
                  size: 36,
                  color: AppTokens.amberInk,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (cat != null)
                      Text(
                        cat.nameBn,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      )
                    else
                      GestureDetector(
                        onTap: onPickCategory,
                        child: Text(
                          l10n.entry_unknownCategory,
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            color: AppTokens.danger,
                          ),
                        ),
                      ),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 15,
                        color: AppTokens.muted,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              formatMoney(Money(draft.amountPaisa), style: numerals),
              style: const TextStyle(
                fontSize: 52,
                fontWeight: FontWeight.w700,
                color: AppTokens.green,
                height: 1.1,
              ),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            amountInWords(draft.amountPaisa),
            style: const TextStyle(fontSize: 17, color: AppTokens.muted),
          ),
          if (compact) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                _RoundAction(
                  label: l10n.entry_again,
                  icon: Icons.volume_up,
                  color: AppTokens.green,
                  filled: false,
                  onTap: onListen,
                ),
                const SizedBox(width: 12),
                _RoundAction(
                  label: l10n.entry_no,
                  icon: Icons.close,
                  color: AppTokens.danger,
                  filled: false,
                  onTap: onNo,
                ),
                const SizedBox(width: 12),
                _RoundAction(
                  label: l10n.entry_yes,
                  icon: Icons.check,
                  color: AppTokens.green,
                  filled: true,
                  onTap: onYes,
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _RoundAction extends StatelessWidget {
  const _RoundAction({
    required this.label,
    required this.icon,
    required this.color,
    required this.filled,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color color;
  final bool filled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: label,
        excludeSemantics: true,
        onTap: onTap,
        child: Material(
          color: filled ? color : AppTokens.white,
          shape: CircleBorder(side: BorderSide(color: color, width: 3)),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: SizedBox(
              width: 56,
              height: 56,
              child: Icon(
                icon,
                size: 28,
                color: filled ? AppTokens.white : color,
              ),
            ),
          ),
        ),
      );
}
