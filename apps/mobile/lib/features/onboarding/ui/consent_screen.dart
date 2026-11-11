import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/redirects.dart';
import '../../../core/l10n/l10n_x.dart';
import '../../../core/l10n/locale_controller.dart';
import '../../../core/money/money_format.dart';
import '../../../core/money/numeral_style_provider.dart';
import '../../../core/theme/tokens.dart';
import '../../../domain/models/api/me.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../../presentation/providers/auth_provider.dart';
import '../../../presentation/providers/providers.dart';
import '../../../ui/big_button.dart';
import '../../family/state/active_family.dart';
import '../data/onboarding_repository.dart';

/// Refreshes the signed-in state once the family exists, so the router can leave `/consent`.
/// Tests override it.
final onboardingFinishProvider = Provider<Future<void> Function()>(
  (ref) => () => ref.read(authProvider.notifier).completeSignIn(),
);

/// A2: privacy consent, then the family (FR-AUTH-10, FR-FAM-01). Board: Consent.dc.html.
/// Route `/consent`. Step 2 of 2 offers the voice tutorial.
///
/// A user who already has a family and only has to accept a newer policy version sees the same
/// screen without the family fields.
class ConsentScreen extends ConsumerStatefulWidget {
  const ConsentScreen({super.key});

  @override
  ConsumerState<ConsentScreen> createState() => _ConsentScreenState();
}

class _ConsentScreenState extends ConsumerState<ConsentScreen> {
  final _nameCtl = TextEditingController();
  bool _agreed = false;
  bool _busy = false;
  bool _failed = false;

  /// Consent was stored on the server: a retry only repeats the family.
  bool _consentSaved = false;
  bool _step2 = false;

  @override
  void dispose() {
    _nameCtl.dispose();
    super.dispose();
  }

  bool get _hasFamily => ref.read(familiesProvider).isNotEmpty;

  bool get _nameOk => _nameCtl.text.trim().runes.length >= 2;

  bool get _canSubmit => _agreed && !_busy && (_hasFamily || _nameOk);

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() {
      _busy = true;
      _failed = false;
    });
    final repo = ref.read(onboardingRepositoryProvider);
    final locale = ref.read(localeProvider);
    try {
      if (!_consentSaved) {
        final policy = await repo.policy(locale);
        await repo.acceptConsent(policy.version, locale);
        _consentSaved = true;
        await ref
            .read(localStoreProvider)
            .setMeta(consentVersionKey, policy.version);
        ref.read(consentCurrentProvider.notifier).state = true;
      }
      if (!_hasFamily) {
        final FamilyInfo family = await repo.createFamily(_nameCtl.text.trim());
        await ref.read(activeFamilyIdProvider.notifier).select(family.id);
        if (mounted) setState(() => _step2 = true);
      }
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _finish({required bool tutorial}) async {
    ref.read(tutorialDoneProvider.notifier).state = !tutorial;
    if (!tutorial) {
      await ref.read(localStoreProvider).setMeta('tutorial_done', '1');
    }
    await ref.read(onboardingFinishProvider)();
    if (!mounted) return;
    GoRouter.maybeOf(context)?.go(tutorial ? Routes.tutorial : Routes.home);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final style = ref.watch(numeralStyleProvider);
    String digits(String v) =>
        style == NumeralStyle.bangla ? toBanglaDigits(v) : v;
    final hasFamily = ref.watch(familiesProvider).isNotEmpty;

    return Scaffold(
      backgroundColor: AppTokens.bg,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, box) => SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: box.maxHeight),
              child: IntrinsicHeight(
                child: _step2
                    ? _stepTwo(l10n, digits)
                    : _stepOne(l10n, digits, hasFamily),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _title(String text) => Semantics(
        header: true,
        child: Text(
          text,
          style: const TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w700,
            color: AppTokens.green,
          ),
        ),
      );

  Widget _stepLabel(
    AppLocalizations l10n,
    String Function(String) digits,
    int n,
  ) =>
      Text(
        l10n.onb_consent_step(digits('$n'), digits('2')),
        style: const TextStyle(fontSize: 16, color: AppTokens.muted),
      );

  Widget _stepTwo(AppLocalizations l10n, String Function(String) digits) =>
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 24),
          _title(l10n.onb_consent_step2Title),
          const SizedBox(height: 6),
          _stepLabel(l10n, digits, 2),
          const SizedBox(height: 24),
          Text(
            l10n.onb_consent_step2Body,
            style: const TextStyle(
              fontSize: 20,
              height: 1.4,
              color: AppTokens.ink,
            ),
          ),
          const Spacer(),
          BigButton(
            key: const Key('consent_listen'),
            label: l10n.onb_consent_listen,
            icon: Icons.volume_up,
            onPressed: () => _finish(tutorial: true),
          ),
          const SizedBox(height: 12),
          BigButton(
            key: const Key('consent_not_now'),
            label: l10n.onb_consent_notNow,
            style: BigButtonStyle.quiet,
            onPressed: () => _finish(tutorial: false),
          ),
          const SizedBox(height: 28),
        ],
      );

  Widget _stepOne(
    AppLocalizations l10n,
    String Function(String) digits,
    bool hasFamily,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 24),
        _title(l10n.onb_consent_title),
        const SizedBox(height: 6),
        _stepLabel(l10n, digits, 1),
        if (!hasFamily) ...[
          const SizedBox(height: 18),
          _label(l10n.onb_consent_nameLabel),
          const SizedBox(height: 8),
          _NameField(
            controller: _nameCtl,
            hint: l10n.onb_consent_nameHint,
            label: l10n.onb_consent_nameLabel,
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 18),
          _label(l10n.onb_consent_currencyLabel),
          const SizedBox(height: 8),
          Container(
            height: 56,
            alignment: AlignmentDirectional.centerStart,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: AppTokens.greenTint,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Text(
              l10n.onb_consent_currencyValue('BDT'),
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: AppTokens.green,
              ),
            ),
          ),
        ],
        const SizedBox(height: 22),
        _label(l10n.onb_consent_useTitle),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          decoration: BoxDecoration(
            color: AppTokens.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppTokens.border),
          ),
          child: Column(
            children: [
              _UseRow(
                icon: Icons.groups_outlined,
                text: l10n.onb_consent_use1,
              ),
              _UseRow(
                icon: Icons.mic_none,
                text: l10n.onb_consent_use2,
              ),
              _UseRow(
                icon: Icons.shield_outlined,
                text: l10n.onb_consent_use3,
                last: true,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            _Check(
              label: l10n.onb_consent_agree,
              checked: _agreed,
              onChanged: (v) => setState(() => _agreed = v),
            ),
            const Spacer(),
            TextButton(
              key: const Key('consent_policy_link'),
              style: TextButton.styleFrom(
                minimumSize: const Size(48, 48),
                foregroundColor: AppTokens.green,
              ),
              onPressed: () =>
                  GoRouter.maybeOf(context)?.push(Routes.consentPolicy),
              child: Text(
                l10n.onb_consent_policy,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
          ],
        ),
        if (_failed) ...[
          const SizedBox(height: 8),
          Semantics(
            liveRegion: true,
            child: Text(
              l10n.onb_consent_error,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppTokens.danger,
              ),
            ),
          ),
        ],
        const Spacer(),
        const SizedBox(height: 16),
        BigButton(
          key: const Key('consent_submit'),
          label:
              (hasFamily ? l10n.onb_welcome_continue : l10n.onb_consent_submit),
          height: 72,
          onPressed: _canSubmit ? _submit : null,
        ),
        const SizedBox(height: 28),
      ],
    );
  }

  Widget _label(String text) => Text(
        text,
        style: const TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: AppTokens.ink,
        ),
      );
}

class _NameField extends StatelessWidget {
  const _NameField({
    required this.controller,
    required this.hint,
    required this.label,
    required this.onChanged,
  });

  final TextEditingController controller;
  final String hint;
  final String label;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => Container(
        height: 64,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: AppTokens.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppTokens.green, width: 3),
        ),
        child: TextField(
          key: const Key('consent_name'),
          controller: controller,
          onChanged: onChanged,
          textInputAction: TextInputAction.done,
          style: const TextStyle(fontSize: 22, color: AppTokens.ink),
          decoration: InputDecoration(
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            filled: false,
            hintText: hint,
            semanticCounterText: label,
            hintStyle: const TextStyle(fontSize: 22, color: AppTokens.muted),
          ),
        ),
      );
}

class _UseRow extends StatelessWidget {
  const _UseRow({required this.icon, required this.text, this.last = false});

  final IconData icon;
  final String text;
  final bool last;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          border: last
              ? null
              : const Border(bottom: BorderSide(color: AppTokens.border)),
        ),
        child: Row(
          children: [
            ExcludeSemantics(
              child: Icon(icon, size: 28, color: AppTokens.green),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                text,
                style: const TextStyle(
                  fontSize: 16,
                  height: 1.35,
                  color: AppTokens.ink,
                ),
              ),
            ),
          ],
        ),
      );
}

/// The agree box: a 40 x 40 green rounded square with a white tick when checked.
class _Check extends StatelessWidget {
  const _Check({
    required this.label,
    required this.checked,
    required this.onChanged,
  });

  final String label;
  final bool checked;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) => Semantics(
        checked: checked,
        label: label,
        excludeSemantics: true,
        onTap: () => onChanged(!checked),
        child: InkWell(
          key: const Key('consent_checkbox'),
          borderRadius: BorderRadius.circular(12),
          onTap: () => onChanged(!checked),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: checked ? AppTokens.green : AppTokens.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTokens.green, width: 2),
                  ),
                  child: checked
                      ? const Icon(
                          Icons.check,
                          size: 26,
                          color: AppTokens.white,
                        )
                      : null,
                ),
                const SizedBox(width: 12),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                    color: AppTokens.ink,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}
