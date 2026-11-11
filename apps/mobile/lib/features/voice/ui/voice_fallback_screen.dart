import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/money/money_format.dart';
import '../../../core/speech/categories.dart';
import '../../../core/theme/tokens.dart';
import '../../../data/api/api_client.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../../presentation/providers/auth_provider.dart';
import '../../../presentation/providers/providers.dart';
import '../../../ui/banner_strip.dart';
import '../../../ui/big_button.dart';
import '../../family/state/active_family.dart';
import '../state/voice_capability_provider.dart';

/// D8: the phone cannot recognise Bangla or has no Bangla voice. Says so plainly, offers the
/// install, and keeps typing working (FR-VOICE-07). Board: VoiceFallback.dc.html.
class VoiceFallbackScreen extends StatelessWidget {
  const VoiceFallbackScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: AppTokens.bg,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 20, 0),
              child: Row(
                children: [
                  IconButton(
                    tooltip: l10n.voice_fallback_back,
                    constraints: const BoxConstraints.tightFor(
                      width: AppTokens.touchMin,
                      height: AppTokens.touchMin,
                    ),
                    icon: const Icon(Icons.chevron_left, size: 32),
                    onPressed: () => Navigator.of(context).maybePop(),
                  ),
                  Expanded(
                    child: Text(
                      l10n.voice_fallback_title,
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const Expanded(child: VoiceFallbackBody()),
          ],
        ),
      ),
    );
  }
}

/// Opens the same content as a bottom sheet (used by mic buttons).
Future<void> showVoiceFallbackSheet(BuildContext context) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTokens.bg,
      builder: (_) => const SizedBox(
        height: 700,
        child: SafeArea(child: VoiceFallbackBody()),
      ),
    );

/// Banner for the case where only the Bangla voice is missing: answers are text only.
class VoiceTtsBanner extends ConsumerWidget {
  const VoiceTtsBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final caps = ref.watch(voiceCapabilityProvider).value;
    if (caps == null || !caps.ttsMissingBangla) return const SizedBox.shrink();
    final l10n = AppLocalizations.of(context);
    return BannerStrip(
      kind: BannerKind.warn,
      text: l10n.voice_fallback_noTts,
      actionLabel: l10n.voice_fallback_noTtsAction,
      onAction: () async {
        final n = ref.read(voiceCapabilityProvider.notifier);
        await n.openInstall();
      },
    );
  }
}

class VoiceFallbackBody extends ConsumerStatefulWidget {
  const VoiceFallbackBody({super.key});

  @override
  ConsumerState<VoiceFallbackBody> createState() => _VoiceFallbackBodyState();
}

class _VoiceFallbackBodyState extends ConsumerState<VoiceFallbackBody>
    with WidgetsBindingObserver {
  final _text = TextEditingController();
  List<TransactionDraft>? _drafts;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _text.dispose();
    super.dispose();
  }

  /// Back from the Play Store: probe again.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(voiceCapabilityProvider.notifier).refresh();
    }
  }

  /// Same parse call as the A3 entry screen.
  Future<void> _parse() async {
    final family = ref.read(activeFamilyProvider);
    final text = _text.text.trim();
    if (family == null || text.isEmpty) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final drafts = await ref.read(apiClientProvider).parse(family.id, text);
      if (mounted) setState(() => _drafts = drafts);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _save(int i) async {
    final d = _drafts![i];
    final store = ref.read(localStoreProvider);
    final notifier = ref.read(appStateProvider.notifier);
    final categoryId = await store.categoryIdForKey(d.categoryKey);
    final accountId = await store.accountIdForType(d.accountType);
    if (d.type == 'income') {
      await notifier.addIncome(
        d.amount,
        note: d.note,
        categoryId: categoryId,
        accountId: accountId,
        source: d.source,
      );
    } else {
      await notifier.addExpense(
        d.amount,
        note: d.note,
        categoryId: categoryId,
        accountId: accountId,
        source: d.source,
      );
    }
    if (!mounted) return;
    setState(() {
      _drafts = [..._drafts!]..removeAt(i);
      if (_drafts!.isEmpty) {
        _drafts = null;
        _text.clear();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
      children: [
        Center(
          child: Container(
            width: 112,
            height: 112,
            decoration: const BoxDecoration(
              color: Color(0xFFF1E6D3),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.mic_off, size: 60, color: AppTokens.muted),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          l10n.voice_fallback_heading,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            height: 1.35,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          l10n.voice_fallback_body,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 17,
            height: 1.5,
            color: Color(0xFF4A3C2C),
          ),
        ),
        const SizedBox(height: 20),
        BigButton(
          label: l10n.voice_fallback_install,
          icon: Icons.download,
          height: 72,
          onPressed: () =>
              ref.read(voiceCapabilityProvider.notifier).openInstall(),
        ),
        const SizedBox(height: 6),
        Text(
          l10n.voice_fallback_installNote,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 13, color: AppTokens.muted),
        ),
        const SizedBox(height: 22),
        Text(
          l10n.voice_fallback_typeTitle,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _text,
                style: const TextStyle(fontSize: 18),
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _parse(),
                decoration: InputDecoration(
                  hintText: l10n.voice_fallback_typeHint,
                  filled: true,
                  fillColor: AppTokens.white,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 18),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(30),
                    borderSide:
                        const BorderSide(color: AppTokens.green, width: 3),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(30),
                    borderSide:
                        const BorderSide(color: AppTokens.green, width: 3),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Semantics(
              button: true,
              label: l10n.voice_fallback_send,
              excludeSemantics: true,
              child: Material(
                color: AppTokens.green,
                shape: const CircleBorder(),
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: _busy ? null : _parse,
                  child: const SizedBox(
                    width: 60,
                    height: 60,
                    child: Icon(
                      Icons.arrow_forward,
                      size: 28,
                      color: AppTokens.white,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              _error!,
              style: const TextStyle(color: AppTokens.danger, fontSize: 16),
            ),
          ),
        if (_drafts != null && _drafts!.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              l10n.voice_fallback_nothing,
              style: const TextStyle(fontSize: 16),
            ),
          ),
        for (var i = 0; i < (_drafts?.length ?? 0); i++) _draft(i, l10n),
        const SizedBox(height: 16),
        const _TtsNote(),
      ],
    );
  }

  Widget _draft(int i, AppLocalizations l10n) {
    final d = _drafts![i];
    final cat = categoryByKey(d.categoryKey);
    return Card(
      margin: const EdgeInsets.only(top: 12),
      child: ListTile(
        leading: Text(cat?.icon ?? '📦', style: const TextStyle(fontSize: 28)),
        title: Text(
          '${formatMoney(d.amount, style: NumeralStyle.bangla)} · ${cat?.nameBn ?? ''}',
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
        ),
        subtitle: Text(d.note),
        trailing: TextButton(
          onPressed: () => _save(i),
          child: Text(l10n.voice_fallback_save),
        ),
      ),
    );
  }
}

/// The amber note under the form, shown when the Bangla voice is also missing.
class _TtsNote extends ConsumerWidget {
  const _TtsNote();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final caps = ref.watch(voiceCapabilityProvider).value;
    if (caps == null || !caps.ttsMissingBangla) return const SizedBox.shrink();
    final l10n = AppLocalizations.of(context);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTokens.amberTint,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          const Icon(Icons.volume_off, size: 24, color: AppTokens.amberInk),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              l10n.voice_fallback_noTts,
              style: const TextStyle(
                fontSize: 15,
                height: 1.4,
                color: AppTokens.amberInk,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
