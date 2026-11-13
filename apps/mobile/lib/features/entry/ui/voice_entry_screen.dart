import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/redirects.dart';
import '../../../core/l10n/l10n_x.dart';
import '../../../core/theme/tokens.dart';
import '../../../data/database/database.dart';
import '../../../domain/models/api/draft.dart';
import '../../../ui/big_button.dart';
import '../../../ui/big_mic_button.dart';
import '../../transactions/data/transaction_repository.dart' show dayHeader;
import '../../transactions/ui/add_expense_screen.dart';
import '../../voice/state/voice_capability_provider.dart';
import '../../voice/ui/voice_fallback_screen.dart';
import '../data/entry_repository.dart';
import '../state/entry_controller.dart';
import 'category_picker_screen.dart';
import 'draft_card.dart';

/// A3 · say it, hear it, confirm it (route `/add/voice`). Board: VoiceEntry.dc.html.
///
/// Opens listening. [initialText] skips the microphone and parses that text instead (typed
/// text, tests, previews).
class VoiceEntryScreen extends ConsumerStatefulWidget {
  const VoiceEntryScreen({super.key, this.initialText});

  final String? initialText;

  @override
  ConsumerState<VoiceEntryScreen> createState() => _VoiceEntryState();
}

class _VoiceEntryState extends ConsumerState<VoiceEntryScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  Future<void> _start() async {
    final c = ref.read(entryControllerProvider.notifier);
    final text = widget.initialText;
    if (text != null) {
      await c.submit(text, source: EntrySource.text);
      return;
    }
    await c.loadQueued();
    if (!mounted ||
        ref.read(entryControllerProvider).phase != EntryPhase.idle) {
      return;
    }
    await _listen();
  }

  Future<void> _listen() async {
    if (!await micMayListen(context, ref)) return;
    await ref.read(entryControllerProvider.notifier).listen();
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

  /// Opens the picture picker for draft [i] and applies the answer.
  Future<void> _pickCategory(int i) async {
    final d = ref.read(entryControllerProvider).drafts[i];
    final l10n = context.l10n;
    final now = ref.read(entryClockProvider)();
    final account = DraftCard.accountLabel(l10n, d.accountType);
    final caption = [
      if (account.isNotEmpty) account,
      dayHeader(d.occurredAt, now),
    ].join(' · ');
    final picked = await context.push<CachedCategory>(
      Routes.addCategory,
      extra: CategoryPickerArgs(
        amountPaisa: d.amountPaisa,
        caption: caption,
        kind: d.type == 'income' ? 'income' : 'expense',
      ),
    );
    if (picked != null && mounted) {
      await ref
          .read(entryControllerProvider.notifier)
          .setCategory(i, picked.key);
    }
  }

  Future<void> _yes(int i) async {
    final c = ref.read(entryControllerProvider.notifier);
    try {
      final saved = await c.save(i);
      if (!saved) {
        if (mounted) await _pickCategory(i);
        return;
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(context.l10n.entry_problem)));
      }
      return;
    }
    if (mounted && ref.read(entryControllerProvider).drafts.isEmpty) _leave();
  }

  Future<void> _no(int i) async {
    await ref.read(entryControllerProvider.notifier).discard(i);
    if (mounted && ref.read(entryControllerProvider).drafts.isEmpty) _leave();
  }

  /// "টাকা বা খাত বদলাতে চাই": D4 opens with this entry filled in.
  Future<void> _change(int i) async {
    final d = ref.read(entryControllerProvider).drafts[i];
    await ref.read(entryControllerProvider.notifier).discard(i);
    if (!mounted) return;
    context.pushReplacement(
      Routes.add,
      extra: AddExpensePrefill(
        amountPaisa: d.amountPaisa,
        categoryKey: d.categoryKey,
        type: d.type == 'income' ? 'income' : 'expense',
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(entryControllerProvider);
    ref.listen<EntryState>(entryControllerProvider, (prev, next) {
      final arrived = prev?.phase != EntryPhase.drafts &&
          next.phase == EntryPhase.drafts &&
          next.drafts.isNotEmpty;
      if (arrived && next.drafts.first.categoryKey == null) _pickCategory(0);
    });
    final busy = s.phase == EntryPhase.saving;

    return Scaffold(
      backgroundColor: AppTokens.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const VoiceTtsBanner(),
              if (s.transcript.isNotEmpty) _Transcript(text: s.transcript),
              Expanded(
                child: s.drafts.isEmpty
                    ? _Idle(state: s, onMic: _onMic, onWrite: _leaveToAdd)
                    : s.drafts.length == 1
                        ? _single(s.drafts.first, busy)
                        : _many(s.drafts, busy),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _onMic() {
    final c = ref.read(entryControllerProvider.notifier);
    if (ref.read(entryControllerProvider).phase == EntryPhase.listening) {
      c.stopListening();
    } else {
      _listen();
    }
  }

  void _leaveToAdd() => context.pushReplacement(Routes.add);

  Widget _single(TransactionDraft d, bool busy) {
    final l10n = context.l10n;
    final c = ref.read(entryControllerProvider.notifier);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 20),
                DraftCard(draft: d, onPickCategory: () => _pickCategory(0)),
                const SizedBox(height: 14),
                _Pill(
                  key: const Key('entry_again'),
                  label: l10n.entry_again,
                  onTap: () => c.readBack(d),
                ),
                const SizedBox(height: 16),
                Text(
                  l10n.entry_confirmQ,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
        Row(
          children: [
            _NoButton(
              key: const Key('entry_no'),
              label: l10n.entry_no,
              onTap: busy ? null : () => _no(0),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: _YesButton(
                key: const Key('entry_yes'),
                label: l10n.entry_yes,
                onTap: busy ? null : () => _yes(0),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Center(
          child: TextButton(
            key: const Key('entry_change'),
            style: TextButton.styleFrom(minimumSize: const Size(48, 52)),
            onPressed: busy ? null : () => _change(0),
            child: Text(
              l10n.entry_change,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppTokens.muted,
                decoration: TextDecoration.underline,
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _many(List<TransactionDraft> drafts, bool busy) {
    final c = ref.read(entryControllerProvider.notifier);
    return ListView.separated(
      padding: const EdgeInsets.only(top: 20, bottom: 20),
      itemCount: drafts.length,
      separatorBuilder: (_, __) => const SizedBox(height: 14),
      itemBuilder: (_, i) => DraftCard(
        key: Key('draft_card_$i'),
        draft: drafts[i],
        compact: true,
        onListen: () => c.readBack(drafts[i]),
        onYes: busy ? null : () => _yes(i),
        onNo: busy ? null : () => _no(i),
        onPickCategory: () => _pickCategory(i),
      ),
    );
  }
}

class _Transcript extends StatelessWidget {
  const _Transcript({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 32),
          Row(
            children: [
              const Icon(Icons.mic_none, size: 22, color: AppTokens.muted),
              const SizedBox(width: 8),
              Text(
                context.l10n.entry_heard,
                style: const TextStyle(fontSize: 15, color: AppTokens.muted),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '"$text"',
            key: const Key('entry_transcript'),
            style: const TextStyle(
              fontSize: 22,
              height: 1.35,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      );
}

/// Nothing to confirm: the microphone, or the reason there are no cards.
class _Idle extends StatelessWidget {
  const _Idle({
    required this.state,
    required this.onMic,
    required this.onWrite,
  });

  final EntryState state;
  final VoidCallback onMic;
  final VoidCallback onWrite;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final listening = state.phase == EntryPhase.listening;
    final parsing = state.phase == EntryPhase.parsing;
    final note = state.quotaExceeded
        ? l10n.entry_quota
        : state.queuedOffline
            ? l10n.entry_queued
            : state.problem
                ? l10n.entry_problem
                : state.micError;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (note != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 24),
            child: Text(
              note,
              key: const Key('entry_note'),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 18,
                height: 1.4,
                color: state.problem || state.micError != null
                    ? AppTokens.danger
                    : AppTokens.ink,
              ),
            ),
          ),
        if (state.quotaExceeded)
          BigButton(
            key: const Key('entry_quota_action'),
            label: l10n.entry_quotaAction,
            onPressed: onWrite,
          )
        else if (parsing)
          Text(
            l10n.entry_parsing,
            style: const TextStyle(fontSize: 20, color: AppTokens.muted),
          )
        else
          BigMicButton.huge(
            key: const Key('entry_mic'),
            label: l10n.entry_speak,
            listening: listening,
            onPressed: onMic,
          ),
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: label,
        excludeSemantics: true,
        onTap: onTap,
        child: Material(
          color: AppTokens.greenTint,
          shape: const StadiumBorder(),
          child: InkWell(
            customBorder: const StadiumBorder(),
            onTap: onTap,
            child: SizedBox(
              height: 64,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.volume_up, size: 28, color: AppTokens.green),
                  const SizedBox(width: 10),
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w700,
                      color: AppTokens.green,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
}

class _NoButton extends StatelessWidget {
  const _NoButton({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: label,
        excludeSemantics: true,
        onTap: onTap,
        child: Material(
          color: AppTokens.white,
          shape: const CircleBorder(
            side: BorderSide(color: AppTokens.danger, width: 3),
          ),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: SizedBox(
              width: 104,
              height: 104,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.close, size: 32, color: AppTokens.danger),
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: AppTokens.danger,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
}

class _YesButton extends StatelessWidget {
  const _YesButton({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: label,
        excludeSemantics: true,
        onTap: onTap,
        child: Material(
          color: AppTokens.green,
          shape: const StadiumBorder(),
          child: InkWell(
            customBorder: const StadiumBorder(),
            onTap: onTap,
            child: SizedBox(
              height: 104,
              child: Center(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.check, size: 44, color: AppTokens.white),
                      const SizedBox(width: 12),
                      Text(
                        label,
                        style: const TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w700,
                          color: AppTokens.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      );
}
