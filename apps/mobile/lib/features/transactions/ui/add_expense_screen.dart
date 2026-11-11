import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/redirects.dart';
import '../../../core/l10n/l10n_x.dart';
import '../../../core/money/money.dart';
import '../../../core/money/money_format.dart';
import '../../../core/money/numeral_style_provider.dart';
import '../../../core/speech/bangla_words.dart';
import '../../../core/theme/tokens.dart';
import '../../../data/database/database.dart';
import '../../../ui/big_button.dart';
import '../../../ui/listen_button.dart';
import '../../family/state/family_providers.dart';
import '../state/add_expense_controller.dart';
import '../widgets/account_chips.dart';
import '../widgets/amount_keypad.dart';
import '../widgets/category_icon_row.dart';

/// D4 · add an entry by hand (route `/add`). Board: AddExpense.dc.html.
class AddExpenseScreen extends ConsumerStatefulWidget {
  const AddExpenseScreen({super.key});

  @override
  ConsumerState<AddExpenseScreen> createState() => _AddExpenseScreenState();
}

class _AddExpenseScreenState extends ConsumerState<AddExpenseScreen> {
  final _note = TextEditingController();
  final _fee = TextEditingController();

  @override
  void initState() {
    super.initState();
    // A Viewer cannot write; if the role turns out to be Viewer, go home (FR-FAM-03).
    ref.listenManual(
      currentRoleFutureProvider,
      (_, next) {
        final role = next.valueOrNull;
        if (role != null && !role.canWriteLedger) _goHome();
      },
      fireImmediately: true,
    );
    ref.listenManual(
      addAccountsProvider,
      (_, next) {
        final list = next.valueOrNull;
        if (list == null || list.isEmpty) return;
        final cash = list.where((a) => a.type == 'cash');
        ref
            .read(addExpenseControllerProvider.notifier)
            .defaultAccount((cash.isNotEmpty ? cash.first : list.first).id);
      },
      fireImmediately: true,
    );
  }

  @override
  void dispose() {
    _note.dispose();
    _fee.dispose();
    super.dispose();
  }

  void _goHome() {
    if (!mounted) return;
    final router = GoRouter.maybeOf(context);
    if (router != null) {
      router.go(Routes.home);
    } else {
      Navigator.of(context).maybePop();
    }
  }

  void _leave() {
    final nav = Navigator.of(context);
    if (nav.canPop()) {
      nav.pop();
    } else {
      GoRouter.maybeOf(context)?.go(Routes.home);
    }
  }

  Future<void> _save() async {
    final controller = ref.read(addExpenseControllerProvider.notifier);
    final id = await controller.save();
    if (id == null || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    final repo = ref.read(transactionRepositoryProvider);
    final l10n = context.l10n;
    _leave();
    messenger
      ..clearSnackBars()
      ..showSnackBar(
        SnackBar(
          duration: const Duration(seconds: 6),
          persist: false, // an action would otherwise keep it on screen

          content: Text(l10n.txn_add_saved),
          action: SnackBarAction(
            label: l10n.txn_add_undo,
            onPressed: () => repo.delete(id),
          ),
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final s = ref.watch(addExpenseControllerProvider);
    final c = ref.read(addExpenseControllerProvider.notifier);
    final numerals = ref.watch(numeralStyleProvider);
    final role = ref.watch(currentRoleFutureProvider).valueOrNull;
    final me = ref.watch(myUserIdProvider).valueOrNull;
    final members = ref.watch(membersProvider).valueOrNull ?? const [];
    final accounts = ref.watch(addAccountsProvider).valueOrNull ?? const [];
    final kind = s.type == 'income' ? 'income' : 'expense';
    final allCategories = ref.watch(addCategoriesProvider).valueOrNull ??
        const <CachedCategory>[];
    final categories = [
      for (final k in allCategories)
        if (!k.isHidden && k.kind == kind) k,
    ];
    final words = amountInWords(s.amountPaisa);
    final amountText = formatMoney(
      Money(s.amountPaisa),
      style: numerals,
      showSymbol: false,
    );
    final canPickPayer = role?.canEditAll ?? false;
    final payers = [
      for (final m in members)
        if (canPickPayer || m.userId == me) m,
    ];

    Widget heading(String text) => Padding(
          padding: const EdgeInsets.only(top: 18, bottom: 6),
          child: Text(
            text,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
          ),
        );

    final error = switch (s.error) {
      AddExpenseError.amount => l10n.txn_add_errAmount,
      AddExpenseError.tooLarge => l10n.txn_add_errMax,
      AddExpenseError.category => l10n.txn_add_errCategory,
      null => null,
    };

    return Scaffold(
      backgroundColor: AppTokens.bg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 20, 0),
              child: Row(
                children: [
                  Semantics(
                    button: true,
                    label: l10n.txn_add_back,
                    excludeSemantics: true,
                    onTap: _leave,
                    child: IconButton(
                      iconSize: 28,
                      constraints: const BoxConstraints(
                        minWidth: 48,
                        minHeight: 48,
                      ),
                      onPressed: _leave,
                      icon: const Icon(Icons.arrow_back, color: AppTokens.ink),
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    l10n.txn_add_title,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _TypeSegments(
                      type: s.type,
                      labels: {
                        'expense': l10n.txn_add_typeExpense,
                        'income': l10n.txn_add_typeIncome,
                        'transfer': l10n.txn_add_typeTransfer,
                      },
                      onChanged: c.setType,
                    ),
                    heading(l10n.txn_add_amountQ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: AppTokens.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppTokens.green, width: 3),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          const Text(
                            '৳',
                            style: TextStyle(
                              fontSize: 30,
                              fontWeight: FontWeight.w700,
                              color: AppTokens.muted,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              alignment: AlignmentDirectional.centerStart,
                              child: Text(
                                amountText,
                                key: const Key('amount_text'),
                                style: const TextStyle(
                                  fontSize: 52,
                                  fontWeight: FontWeight.w700,
                                  height: 1.1,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (s.amountPaisa > 0)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                words,
                                key: const Key('amount_words'),
                                style: const TextStyle(
                                  fontSize: 17,
                                  color: AppTokens.muted,
                                ),
                              ),
                            ),
                            ListenButton(text: words),
                          ],
                        ),
                      ),
                    if (error != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Semantics(
                          liveRegion: true,
                          child: Text(
                            error,
                            key: const Key('add_error'),
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: AppTokens.dangerInk,
                            ),
                          ),
                        ),
                      ),
                    if (s.needsCategory) ...[
                      heading(l10n.txn_add_categoryQ),
                      CategoryIconRow(
                        categories: categories,
                        selectedId: s.categoryId,
                        onSelected: c.setCategory,
                      ),
                    ],
                    heading(l10n.txn_add_accountQ),
                    AccountChips(
                      accounts: [
                        for (final a in accounts) (id: a.id, name: a.name),
                      ],
                      selectedId: s.accountId,
                      onSelected: c.setAccount,
                    ),
                    heading(l10n.txn_add_whoQ),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final m in payers)
                          ChoicePill(
                            label: m.name,
                            selected: m.userId == (s.paidByUserId ?? me),
                            onTap: () => c.setPaidBy(
                              m.userId == me ? null : m.userId,
                            ),
                          ),
                      ],
                    ),
                    heading(l10n.txn_add_date),
                    Wrap(
                      spacing: 8,
                      children: [
                        ChoicePill(
                          label: l10n.txn_add_today,
                          selected: s.daysAgo == 0,
                          onTap: () => c.setDaysAgo(0),
                        ),
                        ChoicePill(
                          label: l10n.txn_add_yesterday,
                          selected: s.daysAgo == 1,
                          onTap: () => c.setDaysAgo(1),
                        ),
                      ],
                    ),
                    heading(l10n.txn_add_note),
                    Semantics(
                      label: l10n.txn_add_note,
                      child: TextField(
                        key: const Key('note_field'),
                        controller: _note,
                        onChanged: c.setNote,
                        style: const TextStyle(fontSize: 16),
                        decoration: InputDecoration(
                          hintText: l10n.txn_add_noteHint,
                          filled: true,
                          fillColor: AppTokens.white,
                          constraints: const BoxConstraints(minHeight: 52),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    _PrivateRow(
                      label: l10n.txn_add_private,
                      value: s.isPrivate,
                      onChanged: c.setPrivate,
                    ),
                    const SizedBox(height: 6),
                    if (!s.showFee)
                      Semantics(
                        button: true,
                        label: l10n.txn_add_feeAdd,
                        excludeSemantics: true,
                        onTap: c.showFee,
                        child: InkWell(
                          key: const Key('fee_add'),
                          onTap: c.showFee,
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(minHeight: 48),
                            child: Align(
                              alignment: AlignmentDirectional.centerStart,
                              child: Text(
                                l10n.txn_add_feeAdd,
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  decoration: TextDecoration.underline,
                                  color: AppTokens.green,
                                ),
                              ),
                            ),
                          ),
                        ),
                      )
                    else
                      Semantics(
                        label: l10n.txn_add_fee,
                        child: TextField(
                          key: const Key('fee_field'),
                          controller: _fee,
                          keyboardType: TextInputType.number,
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(
                              RegExp('[0-9০-৯]'),
                            ),
                          ],
                          onChanged: (v) => c.setFee(toLatinDigits(v)),
                          style: const TextStyle(fontSize: 16),
                          decoration: InputDecoration(
                            hintText: l10n.txn_add_fee,
                            prefixText: '৳ ',
                            filled: true,
                            fillColor: AppTokens.white,
                            constraints: const BoxConstraints(minHeight: 52),
                          ),
                        ),
                      ),
                    const SizedBox(height: 12),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(17, 4, 17, 0),
              child: AmountKeypad(
                style: numerals,
                onDigits: c.pressDigits,
                onBackspace: c.backspace,
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: BigButton(
                label: l10n.txn_add_save,
                icon: Icons.check,
                height: 68,
                onPressed: s.saving ? null : _save,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TypeSegments extends StatelessWidget {
  const _TypeSegments({
    required this.type,
    required this.labels,
    required this.onChanged,
  });

  final String type;
  final Map<String, String> labels;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppTokens.border,
        borderRadius: BorderRadius.circular(26),
      ),
      child: Row(
        children: [
          for (final e in labels.entries)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 3),
                child: Semantics(
                  button: true,
                  selected: type == e.key,
                  label: e.value,
                  excludeSemantics: true,
                  onTap: () => onChanged(e.key),
                  child: Material(
                    color: type == e.key ? AppTokens.green : AppTokens.border,
                    shape: const StadiumBorder(),
                    child: InkWell(
                      key: Key('type_${e.key}'),
                      customBorder: const StadiumBorder(),
                      onTap: () => onChanged(e.key),
                      child: SizedBox(
                        height: 48,
                        child: Center(
                          child: Text(
                            e.value,
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: type == e.key
                                  ? FontWeight.w700
                                  : FontWeight.w600,
                              color: type == e.key
                                  ? AppTokens.white
                                  : AppTokens.ink,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _PrivateRow extends StatelessWidget {
  const _PrivateRow({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      toggled: value,
      label: label,
      excludeSemantics: true,
      onTap: () => onChanged(!value),
      child: Material(
        color: AppTokens.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppTokens.border, width: 2),
        ),
        child: InkWell(
          key: const Key('private_toggle'),
          customBorder: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          onTap: () => onChanged(!value),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Row(
                children: [
                  const Icon(Icons.lock_outline, color: AppTokens.green),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      label,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  IgnorePointer(
                    child: Switch(value: value, onChanged: (_) {}),
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
