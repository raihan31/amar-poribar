import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/redirects.dart';
import '../../../core/l10n/l10n_x.dart';
import '../../../core/money/money.dart';
import '../../../core/money/money_format.dart';
import '../../../core/money/numeral_style_provider.dart';
import '../../../core/sms_parser/sms_parser_engine.dart';
import '../../../core/speech/categories.dart';
import '../../../core/theme/tokens.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../../ui/big_button.dart';
import '../../transactions/data/transaction_repository.dart' show dayHeader;
import '../state/entry_controller.dart';
import '../state/sms_paste_controller.dart';
import 'draft_card.dart';

/// A5 · paste a bKash, Nagad or Rocket message (route `/add/sms`). Board: Sms.dc.html.
///
/// [initialText] is the text shared into the app from another app (Android share target); it
/// is read at once. The text is never stored: it lives in the box only until it is read.
class SmsPasteScreen extends ConsumerStatefulWidget {
  const SmsPasteScreen({super.key, this.initialText});

  final String? initialText;

  @override
  ConsumerState<SmsPasteScreen> createState() => _SmsPasteState();
}

class _SmsPasteState extends ConsumerState<SmsPasteScreen> {
  final _text = TextEditingController();

  @override
  void initState() {
    super.initState();
    _text.addListener(() => setState(() {}));
    final shared = widget.initialText;
    if (shared != null && shared.trim().isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _read(shared));
    }
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _read(String text) async {
    _text.clear();
    await ref.read(smsPasteControllerProvider.notifier).submit(text);
  }

  Future<void> _paste() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final text = data?.text;
    if (text == null || text.trim().isEmpty || !mounted) return;
    await _read(text);
  }

  void _leave() {
    final router = GoRouter.maybeOf(context);
    if (router != null && router.canPop()) {
      router.pop();
    } else if (router != null) {
      router.go(Routes.home);
    } else {
      Navigator.of(context).maybePop();
    }
  }

  Future<void> _keep() async {
    try {
      final saved = await ref.read(smsPasteControllerProvider.notifier).save();
      if (saved && mounted) _leave();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(context.l10n.entry_problem)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final s = ref.watch(smsPasteControllerProvider);
    final showResult = s.draft != null;
    return Scaffold(
      backgroundColor: AppTokens.bg,
      appBar: AppBar(
        backgroundColor: AppTokens.bg,
        elevation: 0,
        leading: Semantics(
          button: true,
          label: MaterialLocalizations.of(context).backButtonTooltip,
          excludeSemantics: true,
          onTap: _leave,
          child: IconButton(
            icon: const Icon(Icons.arrow_back, size: 28),
            onPressed: _leave,
          ),
        ),
        title: Text(
          l10n.entry_sms_title,
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
          children: [
            if (!showResult) ..._pasteArea(l10n, s) else _Result(state: s),
            if (showResult) ...[
              const SizedBox(height: 18),
              _Buttons(
                busy: s.phase == SmsPhase.saving,
                duplicate: s.duplicate,
                onNo: () =>
                    ref.read(smsPasteControllerProvider.notifier).discard(),
                onKeep: _keep,
              ),
            ],
          ],
        ),
      ),
    );
  }

  List<Widget> _pasteArea(AppLocalizations l10n, SmsPasteState s) {
    final note = s.quotaExceeded
        ? l10n.entry_quota
        : s.offline
            ? l10n.entry_sms_offline
            : s.problem
                ? l10n.entry_problem
                : null;
    return [
      CustomPaint(
        painter: const _DashedBorder(),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: TextField(
            key: const Key('sms_text'),
            controller: _text,
            minLines: 5,
            maxLines: 8,
            style: const TextStyle(fontSize: 14, height: 1.4),
            decoration:
                InputDecoration.collapsed(hintText: l10n.entry_sms_hint),
          ),
        ),
      ),
      const SizedBox(height: 14),
      BigButton(
        key: const Key('sms_paste'),
        label: l10n.entry_sms_paste,
        icon: Icons.content_paste,
        style: BigButtonStyle.quiet,
        onPressed: s.phase == SmsPhase.parsing ? null : _paste,
      ),
      if (_text.text.trim().isNotEmpty) ...[
        const SizedBox(height: 12),
        BigButton(
          key: const Key('sms_read'),
          label: l10n.entry_sms_read,
          onPressed:
              s.phase == SmsPhase.parsing ? null : () => _read(_text.text),
        ),
      ],
      if (s.phase == SmsPhase.parsing) ...[
        const SizedBox(height: 18),
        Text(
          l10n.entry_parsing,
          key: const Key('sms_parsing'),
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 20, color: AppTokens.muted),
        ),
      ],
      if (note != null) ...[
        const SizedBox(height: 18),
        Text(
          note,
          key: const Key('sms_note'),
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 18,
            height: 1.4,
            color: s.quotaExceeded ? AppTokens.ink : AppTokens.danger,
          ),
        ),
      ],
    ];
  }
}

/// The recognised message: banner, the amount card and the category chips.
class _Result extends ConsumerWidget {
  const _Result({required this.state});

  final SmsPasteState state;

  static const _billKeys = {
    'electricity',
    'gas',
    'water',
    'internet',
    'mobile_recharge',
  };

  String _kindLabel(AppLocalizations l10n, SmsKind? k) => switch (k) {
        SmsKind.send => l10n.entry_sms_kind_send,
        SmsKind.payment => l10n.entry_sms_kind_payment,
        SmsKind.bill => l10n.entry_sms_kind_bill,
        SmsKind.recharge => l10n.entry_sms_kind_recharge,
        SmsKind.cashOut => l10n.entry_sms_kind_cashOut,
        SmsKind.cashIn => l10n.entry_sms_kind_cashIn,
        SmsKind.received => l10n.entry_sms_kind_received,
        null => l10n.entry_typeExpense,
      };

  /// "আজ, দুপুর ২:৩২" in Asia/Dhaka.
  static String timeLabel(String iso, DateTime now) {
    final at = DateTime.parse(iso).toUtc().add(const Duration(hours: 6));
    final h = at.hour;
    final period = h < 4
        ? 'রাত'
        : h < 6
            ? 'ভোর'
            : h < 12
                ? 'সকাল'
                : h < 15
                    ? 'দুপুর'
                    : h < 17
                        ? 'বিকাল'
                        : h < 19
                            ? 'সন্ধ্যা'
                            : 'রাত';
    final h12 = h % 12 == 0 ? 12 : h % 12;
    final mm = at.minute.toString().padLeft(2, '0');
    return '${dayHeader(iso, now)}, $period $h12:$mm';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final d = state.draft!;
    final numerals = ref.watch(numeralStyleProvider);
    final now = ref.watch(entryClockProvider)();
    String digits(String s) =>
        numerals == NumeralStyle.bangla ? toBanglaDigits(s) : s;
    final account = DraftCard.accountLabel(l10n, d.accountType);
    final provider = state.provider == null
        ? ''
        : DraftCard.accountLabel(l10n, state.provider!.name);

    final rows = <(String, String, Key)>[
      if (d.counterparty != null)
        (l10n.entry_sms_who, digits(d.counterparty!), const Key('sms_who')),
      (
        l10n.entry_sms_fee,
        formatMoney(Money(d.feePaisa), style: numerals),
        const Key('sms_fee'),
      ),
      if (account.isNotEmpty)
        (l10n.entry_sms_account, account, const Key('sms_account')),
      (
        l10n.entry_sms_time,
        digits(timeLabel(d.occurredAt, now)),
        const Key('sms_time'),
      ),
      if (d.trxId != null) (l10n.entry_sms_trx, d.trxId!, const Key('sms_trx')),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          key: const Key('sms_banner'),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: AppTokens.greenTint,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              const Icon(Icons.check_circle, size: 24, color: AppTokens.green),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  state.usedAi
                      ? l10n.entry_sms_recognizedAi
                      : l10n.entry_sms_recognized(provider),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppTokens.deepGreen,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppTokens.white,
            borderRadius: BorderRadius.circular(28),
            border: Border.all(
              color: state.duplicate ? AppTokens.amber : AppTokens.green,
              width: 2,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _kindLabel(l10n, state.kind),
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppTokens.muted,
                ),
              ),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  formatMoney(Money(d.amountPaisa), style: numerals),
                  key: const Key('sms_amount'),
                  style: const TextStyle(
                    fontSize: 46,
                    fontWeight: FontWeight.w700,
                    color: AppTokens.green,
                    height: 1.15,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              for (final (label, value, key) in rows)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 104,
                        child: Text(
                          label,
                          style: const TextStyle(
                            fontSize: 16,
                            color: AppTokens.muted,
                          ),
                        ),
                      ),
                      Expanded(
                        child: Text(
                          value,
                          key: key,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (state.duplicate)
          Container(
            key: const Key('sms_duplicate'),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTokens.amberTint,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline, color: AppTokens.amberInk),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    l10n.entry_sms_duplicate,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppTokens.amberInk,
                    ),
                  ),
                ),
              ],
            ),
          )
        else ...[
          Text(
            l10n.entry_sms_new,
            key: const Key('sms_new'),
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: _chips(context, ref, d.type, d.categoryKey),
          ),
        ],
      ],
    );
  }

  List<Widget> _chips(
    BuildContext context,
    WidgetRef ref,
    String type,
    String? selected,
  ) {
    final l10n = context.l10n;
    final bill = _billKeys.contains(selected) ? selected! : 'electricity';
    final options = type == 'expense' || type == 'transfer'
        ? <(String, String, bool)>[
            (
              'family_support',
              l10n.entry_sms_chipFamily,
              selected == 'family_support'
            ),
            (bill, l10n.entry_sms_chipBill, _billKeys.contains(selected)),
            (
              'other_expense',
              l10n.entry_sms_chipOther,
              selected == 'other_expense' || selected == 'fees',
            ),
          ]
        : <(String, String, bool)>[
            for (final k in const ['other_income', 'remittance', 'business'])
              (k, categoryByKey(k)?.nameBn ?? k, selected == k),
          ];
    return [
      for (final (key, label, on) in options)
        Semantics(
          button: true,
          selected: on,
          label: label,
          excludeSemantics: true,
          onTap: () =>
              ref.read(smsPasteControllerProvider.notifier).setCategory(key),
          child: Material(
            color: on ? AppTokens.green : AppTokens.white,
            shape: StadiumBorder(
              side: BorderSide(
                color: on ? AppTokens.green : AppTokens.inputBorder,
                width: 2,
              ),
            ),
            child: InkWell(
              key: Key('sms_chip_$key'),
              customBorder: const StadiumBorder(),
              onTap: () => ref
                  .read(smsPasteControllerProvider.notifier)
                  .setCategory(key),
              child: Container(
                constraints: const BoxConstraints(minHeight: 52),
                padding: const EdgeInsets.symmetric(horizontal: 20),
                alignment: Alignment.center,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (on) ...[
                      const Icon(Icons.check, size: 22, color: AppTokens.white),
                      const SizedBox(width: 6),
                    ],
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: on ? AppTokens.white : AppTokens.ink,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
    ];
  }
}

class _Buttons extends StatelessWidget {
  const _Buttons({
    required this.busy,
    required this.duplicate,
    required this.onNo,
    required this.onKeep,
  });

  final bool busy;
  final bool duplicate;
  final VoidCallback onNo;
  final VoidCallback onKeep;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Row(
      children: [
        Expanded(
          flex: 2,
          child: BigButton(
            key: const Key('sms_no'),
            label: l10n.entry_sms_no,
            style: BigButtonStyle.outline,
            onPressed: busy ? null : onNo,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          flex: 3,
          child: BigButton(
            key: const Key('sms_keep'),
            label: l10n.entry_sms_keep,
            onPressed: busy || duplicate ? null : onKeep,
          ),
        ),
      ],
    );
  }
}

/// A 2 dp dashed rounded border around the paste box.
class _DashedBorder extends CustomPainter {
  const _DashedBorder();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppTokens.inputBorder
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    final path = Path()
      ..addRRect(
        RRect.fromRectAndRadius(
          Offset.zero & size,
          const Radius.circular(20),
        ),
      );
    for (final metric in path.computeMetrics()) {
      var at = 0.0;
      while (at < metric.length) {
        canvas.drawPath(metric.extractPath(at, at + 8), paint);
        at += 14;
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}
