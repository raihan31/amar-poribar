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
import '../../../domain/models/role.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../../ui/banner_strip.dart';
import '../../../ui/category_icon.dart';
import '../../family/state/family_providers.dart';
import '../data/transaction_repository.dart';
import '../state/add_expense_controller.dart';
import 'add_expense_screen.dart';

/// Whether [role] may change or delete a row written by [createdBy] (FR-FAM-03): Admin and Owner
/// change any row, a Member only their own, a Viewer none.
bool canChangeEntry(FamilyRole? role, {required String? me, Transaction? row}) {
  if (role == null) return false;
  if (role.canEditAll) return true;
  if (!role.canWriteLedger || row == null) return false;
  return row.createdBy == me ||
      (row.createdBy == null && row.paidByUserId == me);
}

/// D5 · one entry in full, with change, delete and undo (route `/txn/:id`).
/// Board: TxnDetail.dc.html.
class TransactionDetailScreen extends ConsumerStatefulWidget {
  const TransactionDetailScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<TransactionDetailScreen> createState() => _DetailState();
}

class _DetailState extends ConsumerState<TransactionDetailScreen> {
  Transaction? _row;
  var _loaded = false;
  var _deleted = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final t = await ref.read(transactionRepositoryProvider).byId(widget.id);
    if (!mounted) return;
    setState(() {
      _row = t ?? _row;
      _loaded = true;
    });
  }

  void _back() {
    final nav = Navigator.of(context);
    if (nav.canPop()) {
      nav.pop();
    } else {
      GoRouter.maybeOf(context)?.go(Routes.home);
    }
  }

  Future<void> _edit() async {
    final router = GoRouter.maybeOf(context);
    if (router != null) {
      await router.push('/txn/${widget.id}/edit');
    } else {
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => AddExpenseScreen(editId: widget.id),
        ),
      );
    }
    if (mounted) await _load();
  }

  Future<void> _delete() async {
    await ref.read(transactionRepositoryProvider).delete(widget.id);
    if (mounted) setState(() => _deleted = true);
  }

  Future<void> _restore() async {
    final messenger = ScaffoldMessenger.of(context);
    final l10n = context.l10n;
    try {
      await ref.read(transactionRepositoryProvider).restore(widget.id);
    } on RestoreWindowClosed {
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.txn_detail_restoreClosed)),
      );
      return;
    }
    if (mounted) setState(() => _deleted = false);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final row = _row;
    final role = ref.watch(currentRoleFutureProvider).valueOrNull;
    final me = ref.watch(myUserIdProvider).valueOrNull;

    Widget body;
    if (row == null) {
      body = Center(
        child: _loaded
            ? Text(
                l10n.txn_detail_notFound,
                style: const TextStyle(fontSize: 20),
              )
            : const CircularProgressIndicator(),
      );
    } else {
      body = _Body(
        row: row,
        canChange: canChangeEntry(role, me: me, row: row),
        deleted: _deleted,
        onEdit: _edit,
        onDelete: _delete,
        onRestore: _restore,
      );
    }

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
                    label: l10n.txn_detail_back,
                    excludeSemantics: true,
                    onTap: _back,
                    child: IconButton(
                      iconSize: 28,
                      constraints: const BoxConstraints(
                        minWidth: 48,
                        minHeight: 48,
                      ),
                      onPressed: _back,
                      icon: const Icon(Icons.arrow_back, color: AppTokens.ink),
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    l10n.txn_detail_title,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({
    required this.row,
    required this.canChange,
    required this.deleted,
    required this.onEdit,
    required this.onDelete,
    required this.onRestore,
  });

  final Transaction row;
  final bool canChange;
  final bool deleted;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onRestore;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final numerals = ref.watch(numeralStyleProvider);
    final english = Localizations.localeOf(context).languageCode == 'en';
    final categories = ref.watch(addCategoriesProvider).valueOrNull ?? const [];
    final accounts = ref.watch(addAccountsProvider).valueOrNull ?? const [];
    final members = ref.watch(membersProvider).valueOrNull ?? const [];
    final now = ref.watch(addExpenseClockProvider)();

    CachedCategory? category;
    for (final c in categories) {
      if (c.id == row.categoryId) category = c;
    }
    CachedAccount? account;
    for (final a in accounts) {
      if (a.id == row.accountId) account = a;
    }
    final payerId = row.paidByUserId ?? row.createdBy;
    String? payer;
    for (final m in members) {
      if (m.userId == payerId) payer = m.name;
    }

    final categoryName =
        category == null ? '' : (english ? category.nameEn : category.nameBn);
    final amountColor = switch (row.type) {
      'income' => AppTokens.green,
      'expense' => AppTokens.danger,
      _ => AppTokens.ink,
    };
    final amount = switch (row.type) {
      'income' => formatMoney(
          Money(row.amountPaisa),
          style: numerals,
          signed: true,
        ),
      'expense' => formatMoney(Money(-row.amountPaisa), style: numerals),
      _ => formatMoney(Money(row.amountPaisa), style: numerals),
    };

    final trx = row.trxId;
    final trxText = trx != null && trx.isNotEmpty
        ? trx
        : (account?.type == 'cash'
            ? l10n.txn_detail_trxCash
            : l10n.txn_detail_trxNone);

    return Column(
      children: [
        if (deleted)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: BannerStrip(
                kind: BannerKind.warn,
                text: l10n.txn_detail_deleted,
                actionLabel: l10n.txn_detail_restore,
                onAction: onRestore,
              ),
            ),
          ),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: AppTokens.white,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: AppTokens.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 56,
                            height: 56,
                            decoration: BoxDecoration(
                              color: AppTokens.amberTint,
                              borderRadius: BorderRadius.circular(18),
                            ),
                            child: Icon(
                              categoryIconData(category?.key),
                              size: 32,
                              color: AppTokens.amberInk,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  categoryName,
                                  style: const TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                Text(
                                  _whenText(
                                    row.occurredAt,
                                    now,
                                    numerals,
                                    l10n,
                                  ),
                                  style: const TextStyle(
                                    fontSize: 14,
                                    color: AppTokens.muted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: AlignmentDirectional.centerStart,
                        child: Text(
                          amount,
                          key: const Key('detail_amount'),
                          style: TextStyle(
                            fontSize: 46,
                            fontWeight: FontWeight.w700,
                            height: 1.1,
                            color: amountColor,
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        amountInWords(row.amountPaisa),
                        style: const TextStyle(
                          fontSize: 16,
                          color: AppTokens.muted,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 6),
                _InfoRow(l10n.txn_detail_account, Text(account?.name ?? '—')),
                _InfoRow(l10n.txn_detail_who, Text(payer ?? '—')),
                _InfoRow(l10n.txn_detail_source, _SourceChip(row.source)),
                _InfoRow(
                  l10n.txn_detail_trxId,
                  trx != null && trx.isNotEmpty
                      ? InkWell(
                          key: const Key('trx_copy'),
                          onTap: () {
                            Clipboard.setData(ClipboardData(text: trx));
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(l10n.txn_detail_trxCopied),
                              ),
                            );
                          },
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(trx, style: const TextStyle(fontSize: 15)),
                                const SizedBox(width: 6),
                                const Icon(Icons.copy, size: 18),
                              ],
                            ),
                          ),
                        )
                      : Text(trxText, style: const TextStyle(fontSize: 15)),
                ),
                if ((row.note ?? '').isNotEmpty)
                  _InfoRow(l10n.txn_detail_note, Text(row.note!)),
                _InfoRow(
                  l10n.txn_detail_visibility,
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (row.isPrivate) ...[
                        const Icon(
                          Icons.lock_outline,
                          size: 22,
                          color: AppTokens.green,
                        ),
                        const SizedBox(width: 6),
                      ],
                      Text(
                        row.isPrivate
                            ? l10n.txn_detail_private
                            : l10n.txn_detail_family,
                      ),
                    ],
                  ),
                  last: row.attachmentKey == null,
                ),
                if (row.attachmentKey != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: _AttachmentThumb(label: l10n.txn_detail_attachment),
                  ),
                if (!canChange && !deleted)
                  Container(
                    margin: const EdgeInsets.only(top: 12),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppTokens.greenTint,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.info_outline,
                          size: 24,
                          color: AppTokens.deepGreen,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            l10n.txn_detail_ownOnly,
                            style: const TextStyle(
                              fontSize: 15,
                              color: AppTokens.deepGreen,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 12),
              ],
            ),
          ),
        ),
        if (canChange && !deleted)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: _OutlinedAction(
                    key: const Key('detail_edit'),
                    label: l10n.txn_detail_edit,
                    icon: Icons.edit_outlined,
                    color: AppTokens.green,
                    height: 64,
                    onPressed: onEdit,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _OutlinedAction(
                    key: const Key('detail_delete'),
                    label: l10n.txn_detail_delete,
                    icon: Icons.delete_outline,
                    color: AppTokens.danger,
                    height: 56, // never the largest button on the screen
                    onPressed: onDelete,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

String _whenText(
  String occurredAtIso,
  DateTime now,
  NumeralStyle numerals,
  AppLocalizations l10n,
) {
  final local =
      DateTime.parse(occurredAtIso).toUtc().add(const Duration(hours: 6));
  final h = local.hour;
  final period = h >= 5 && h < 12
      ? l10n.txn_detail_morning
      : h >= 12 && h < 15
          ? l10n.txn_detail_noon
          : h >= 15 && h < 18
              ? l10n.txn_detail_afternoon
              : h >= 18 && h < 20
                  ? l10n.txn_detail_evening
                  : l10n.txn_detail_night;
  final h12 = h % 12 == 0 ? 12 : h % 12;
  var time = '$h12:${local.minute.toString().padLeft(2, '0')}';
  if (numerals == NumeralStyle.bangla) time = toBanglaDigits(time);
  return '${dayHeader(occurredAtIso, now)}, $period $time';
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(this.label, this.value, {this.last = false});

  final String label;
  final Widget value;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 48),
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      decoration: BoxDecoration(
        border: last
            ? null
            : const Border(bottom: BorderSide(color: Color(0xFFF1E6D3))),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 15, color: AppTokens.muted),
          ),
          const SizedBox(width: 12),
          Flexible(
            child: DefaultTextStyle.merge(
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
              textAlign: TextAlign.end,
              child: value,
            ),
          ),
        ],
      ),
    );
  }
}

class _SourceChip extends StatelessWidget {
  const _SourceChip(this.source);

  final String source;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final (label, icon) = switch (source) {
      'voice' => (l10n.txn_detail_srcVoice, Icons.mic_none),
      'sms' => (l10n.txn_detail_srcSms, Icons.sms_outlined),
      'ai_text' => (l10n.txn_detail_srcText, Icons.chat_bubble_outline),
      'sync' => (l10n.txn_detail_srcSync, Icons.sync),
      _ => (l10n.txn_detail_srcManual, Icons.edit_outlined),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: AppTokens.greenTint,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 20, color: AppTokens.deepGreen),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(fontSize: 15, color: AppTokens.deepGreen),
          ),
        ],
      ),
    );
  }
}

/// Receipt thumbnail. Tap opens it full screen. The image bytes come from the media cache once
/// T-MOB-33 lands; until then a placeholder tile stands in.
class _AttachmentThumb extends StatelessWidget {
  const _AttachmentThumb({required this.label});

  final String label;

  Widget _tile(double size) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: AppTokens.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTokens.border),
        ),
        child:
            const Icon(Icons.image_outlined, size: 40, color: AppTokens.muted),
      );

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: Align(
        alignment: AlignmentDirectional.centerStart,
        child: InkWell(
          key: const Key('attachment_thumb'),
          borderRadius: BorderRadius.circular(16),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              fullscreenDialog: true,
              builder: (_) => Scaffold(
                backgroundColor: AppTokens.callBg,
                appBar: AppBar(
                  backgroundColor: AppTokens.callBg,
                  foregroundColor: AppTokens.white,
                ),
                body: const Center(
                  child: Icon(
                    Icons.image_outlined,
                    size: 120,
                    color: AppTokens.white,
                  ),
                ),
              ),
            ),
          ),
          child: _tile(96),
        ),
      ),
    );
  }
}

class _OutlinedAction extends StatelessWidget {
  const _OutlinedAction({
    super.key,
    required this.label,
    required this.icon,
    required this.color,
    required this.height,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final Color color;
  final double height;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      onTap: onPressed,
      child: Material(
        color: AppTokens.white,
        shape: StadiumBorder(side: BorderSide(color: color, width: 3)),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: onPressed,
          child: SizedBox(
            height: height,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 26, color: color),
                const SizedBox(width: 8),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w700,
                    color: color,
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
