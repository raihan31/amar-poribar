import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/redirects.dart';
import '../../../core/l10n/l10n_x.dart';
import '../../../core/money/money.dart';
import '../../../core/money/money_format.dart';
import '../../../core/money/numeral_style_provider.dart';
import '../../../data/database/database.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../../ui/big_button.dart';
import '../../../ui/empty_state.dart';
import '../../family/state/family_providers.dart';
import '../../home/state/home_providers.dart';
import '../../summary/data/summary_repository.dart' show monthName;
import '../data/transaction_repository.dart' show dayHeader;
import '../state/add_expense_controller.dart';
import '../state/transactions_controller.dart';
import '../widgets/filter_chips.dart';
import '../widgets/txn_row.dart';

/// B1 · the month's entries (route `/list`, tab 2). Board: Txns.dc.html.
class TransactionsScreen extends ConsumerStatefulWidget {
  const TransactionsScreen({super.key});

  @override
  ConsumerState<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends ConsumerState<TransactionsScreen> {
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_maybeLoadMore);
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _maybeLoadMore() {
    if (!_scroll.hasClients) return;
    final pos = _scroll.position;
    if (pos.pixels >= pos.maxScrollExtent - 400) {
      ref.read(transactionsControllerProvider.notifier).loadMore();
    }
  }

  Future<void> _refresh() async {
    await ref.read(homeRefreshProvider)();
    await ref.read(transactionsControllerProvider.notifier).refresh();
  }

  void _goMonth(int delta) {
    final month = ref.read(txnMonthProvider);
    ref.read(txnMonthChoiceProvider.notifier).state = shiftMonth(month, delta);
  }

  Future<void> _csv() async {
    final messenger = ScaffoldMessenger.of(context);
    final failed = context.l10n.txn_list_csvFailed;
    try {
      final rows =
          await ref.read(transactionsControllerProvider.notifier).allRows();
      final cats = ref.read(addCategoriesProvider).valueOrNull ?? const [];
      final accs = ref.read(addAccountsProvider).valueOrNull ?? const [];
      final mems = ref.read(membersProvider).valueOrNull ?? const [];
      final csv = buildTransactionsCsv(
        rows,
        categories: {for (final c in cats) c.id: c.nameBn},
        accounts: {for (final a in accs) a.id: a.name},
        members: {for (final m in mems) m.userId: m.name},
      );
      final month = ref.read(txnMonthProvider);
      await ref.read(csvSharerProvider)('amar-poribar-$month.csv', csv);
    } catch (_) {
      messenger.showSnackBar(SnackBar(content: Text(failed)));
    }
  }

  String _sourceWord(AppLocalizations l10n, String source) => switch (source) {
        'voice' => l10n.txn_list_srcVoice,
        'sms' => l10n.txn_list_srcSms,
        'receipt' => l10n.txn_list_srcPhoto,
        _ => l10n.txn_list_srcManual,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final p = ListPalette.of(context);
    final state = ref.watch(transactionsControllerProvider);
    final month = ref.watch(txnMonthProvider);
    final filter = ref.watch(txnFilterProvider);
    final numerals = ref.watch(numeralStyleProvider);
    final role = ref.watch(currentRoleProvider);
    final cats = ref.watch(addCategoriesProvider).valueOrNull ?? const [];
    final accounts = ref.watch(addAccountsProvider).valueOrNull ?? const [];
    final members = ref.watch(membersProvider).valueOrNull ?? const [];
    final now = ref.watch(homeClockProvider)();
    final locale = Localizations.localeOf(context);

    final catById = {for (final c in cats) c.id: c};
    final accName = {for (final a in accounts) a.id: a.name};
    final memName = {for (final m in members) m.userId: m.name};
    final year = month.split('-')[0];
    final monthLabel = '${monthName(month, locale)} '
        '${locale.languageCode == 'en' ? year : toBanglaDigits(year)}';
    final notifier = ref.read(txnFilterProvider.notifier);

    final options = [
      FilterOption(
        l10n.txn_list_all,
        filter == TxnFilter.all,
        () => notifier.state = TxnFilter.all,
      ),
      for (final m in members)
        FilterOption(
          m.name,
          filter.memberId == m.userId,
          () => notifier.state = TxnFilter(memberId: m.userId),
        ),
      for (final a in accounts)
        FilterOption(
          a.name,
          filter.accountId == a.id,
          () => notifier.state = TxnFilter(accountId: a.id),
        ),
    ];

    Widget rowFor(Transaction t) {
      final cat = catById[t.categoryId];
      final title = t.isPrivate
          ? l10n.txn_list_private
          : t.type == 'transfer'
              ? l10n.txn_list_transfer
              : cat?.nameBn ?? (t.note ?? l10n.txn_list_other);
      final subtitle = t.isPrivate
          ? l10n.txn_list_privateSub
          : [
              memName[t.paidByUserId],
              accName[t.accountId],
              _sourceWord(l10n, t.source),
            ].whereType<String>().where((s) => s.isNotEmpty).join(' · ');
      final direction = switch (t.type) {
        'income' => TxnDirection.income,
        'transfer' => TxnDirection.neutral,
        _ => TxnDirection.expense,
      };
      final signed = direction == TxnDirection.expense
          ? Money(-t.amountPaisa)
          : Money(t.amountPaisa);
      return TxnRow(
        title: title,
        subtitle: subtitle,
        amount: formatMoney(
          signed,
          style: numerals,
          signed: direction == TxnDirection.income,
        ),
        direction: direction,
        categoryKey: cat?.key,
        isPrivate: t.isPrivate,
        onTap: () => context.push(Routes.txn.replaceFirst(':id', t.id)),
      );
    }

    final entries = <Widget>[];
    String? lastHeader;
    for (final t in state.items) {
      final header = dayHeader(t.occurredAt, now);
      if (header != lastHeader) {
        lastHeader = header;
        entries.add(
          Padding(
            padding: EdgeInsets.only(top: entries.isEmpty ? 8 : 10),
            child: Text(
              header,
              style: TextStyle(fontSize: 14, color: p.muted),
            ),
          ),
        );
      }
      entries.add(rowFor(t));
    }
    if (state.loadingMore) {
      entries.add(
        const Padding(
          padding: EdgeInsets.all(16),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    return Scaffold(
      backgroundColor: p.bg,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      l10n.txn_list_title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        color: p.green,
                      ),
                    ),
                  ),
                  if (role.canWriteLedger) _CsvButton(onTap: _csv),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _MonthArrow(
                    label: l10n.txn_list_prevMonth,
                    icon: Icons.chevron_left,
                    onTap: () => _goMonth(-1),
                  ),
                  Text(
                    monthLabel,
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: p.ink,
                    ),
                  ),
                  _MonthArrow(
                    label: l10n.txn_list_nextMonth,
                    icon: Icons.chevron_right,
                    onTap: () => _goMonth(1),
                  ),
                ],
              ),
            ),
            FilterChips(options: options),
            Expanded(
              child: state.loading
                  ? const SizedBox.shrink()
                  : state.items.isEmpty
                      ? EmptyState(
                          icon: Icons.receipt_long_outlined,
                          message: l10n.txn_list_empty,
                          speakHint: false,
                          actionLabel: role.canWriteLedger
                              ? l10n.txn_list_emptyAction
                              : null,
                          onAction: () => context.push(Routes.addVoice),
                        )
                      : RefreshIndicator(
                          onRefresh: _refresh,
                          child: ListView(
                            controller: _scroll,
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 20,
                            ),
                            children: entries,
                          ),
                        ),
            ),
            if (role.canWriteLedger)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 10),
                child: BigButton(
                  label: l10n.txn_list_new,
                  height: 64,
                  onPressed: () => context.push(Routes.add),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _CsvButton extends StatelessWidget {
  const _CsvButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = ListPalette.of(context);
    final label = context.l10n.txn_list_csv;
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      onTap: onTap,
      child: Material(
        color: p.surface,
        shape: StadiumBorder(side: BorderSide(color: p.green, width: 2)),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: onTap,
          child: Container(
            height: 48,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            alignment: Alignment.center,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: p.green,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MonthArrow extends StatelessWidget {
  const _MonthArrow({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: label,
        excludeSemantics: true,
        onTap: onTap,
        child: InkResponse(
          onTap: onTap,
          radius: 28,
          child: SizedBox(
            width: 48,
            height: 48,
            child: Icon(icon, size: 30, color: ListPalette.of(context).ink),
          ),
        ),
      );
}
