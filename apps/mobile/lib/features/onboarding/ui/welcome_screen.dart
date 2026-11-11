import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/redirects.dart';
import '../../../core/l10n/l10n_x.dart';
import '../../../core/money/money.dart';
import '../../../core/money/money_format.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/theme/ui_scale.dart';
import '../../../presentation/providers/auth_provider.dart';
import '../../../presentation/providers/providers.dart';
import '../../../ui/big_button.dart';
import '../../settings/state/preferences_controller.dart';

/// D1: the first screen. Language, numerals and Simple mode, before sign-in (FR-ONB-01).
/// Board: Welcome.dc.html. Route `/welcome`.
class WelcomeScreen extends ConsumerStatefulWidget {
  const WelcomeScreen({super.key});

  @override
  ConsumerState<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends ConsumerState<WelcomeScreen> {
  bool _spoke = false;

  Future<void> _toggleSimple(bool on, String headline) async {
    await ref.read(preferencesProvider.notifier).setSimpleMode(on);
    if (on && !_spoke) {
      _spoke = true;
      await ref.read(voiceServiceProvider).speak(headline);
    }
  }

  Future<void> _continue() async {
    await ref.read(localStoreProvider).setMeta('welcome_done', '1');
    ref.read(welcomeDoneProvider.notifier).state = true;
    if (mounted) GoRouter.maybeOf(context)?.go(Routes.login);
  }

  @override
  Widget build(BuildContext context) {
    final prefs = ref.watch(preferencesProvider);
    final simple = ref.watch(uiScaleProvider) == UiScale.simple;
    // The preview follows the chosen language at once, even before the app locale rebuilds.
    return Localizations.override(
      context: context,
      locale: prefs.locale,
      child: Builder(
        builder: (context) {
          final l10n = context.l10n;
          final bn = prefs.locale.languageCode == 'bn';
          final ctl = ref.read(preferencesProvider.notifier);
          String both(String own, String other) => bn ? '$own · $other' : own;
          return Scaffold(
            backgroundColor: AppTokens.bg,
            body: SafeArea(
              child: LayoutBuilder(
                builder: (context, box) => SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: box.maxHeight),
                    child: IntrinsicHeight(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const SizedBox(height: 24),
                          _Header(
                            title: l10n.onb_welcome_title,
                            subtitle:
                                bn ? 'Welcome to Amar Poribar' : 'আমার পরিবার',
                          ),
                          const SizedBox(height: 24),
                          _Heading(
                            both(l10n.onb_welcome_langTitle, 'Language'),
                          ),
                          const SizedBox(height: 8),
                          _ChipRow(
                            first: _Chip(
                              key: const Key('welcome_lang_bn'),
                              label: 'বাংলা',
                              semantic: l10n.onb_welcome_semBangla,
                              selected: prefs.locale.languageCode == 'bn',
                              onTap: () => ctl.setLocale(const Locale('bn')),
                            ),
                            second: _Chip(
                              key: const Key('welcome_lang_en'),
                              label: 'English',
                              semantic: l10n.onb_welcome_semEnglish,
                              selected: prefs.locale.languageCode == 'en',
                              onTap: () => ctl.setLocale(const Locale('en')),
                            ),
                          ),
                          const SizedBox(height: 20),
                          _Heading(
                            both(l10n.onb_welcome_numTitle, 'Numbers'),
                          ),
                          const SizedBox(height: 8),
                          _ChipRow(
                            first: _Chip(
                              key: const Key('welcome_num_bangla'),
                              label: '১২৩',
                              semantic: l10n.onb_welcome_semBanglaNum,
                              selected:
                                  prefs.numeralStyle == NumeralStyle.bangla,
                              onTap: () =>
                                  ctl.setNumeralStyle(NumeralStyle.bangla),
                            ),
                            second: _Chip(
                              key: const Key('welcome_num_latin'),
                              label: '123',
                              semantic: l10n.onb_welcome_semLatinNum,
                              selected:
                                  prefs.numeralStyle == NumeralStyle.latin,
                              onTap: () =>
                                  ctl.setNumeralStyle(NumeralStyle.latin),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            formatMoney(
                              Money.fromTaka(125000),
                              style: prefs.numeralStyle,
                            ),
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                              color: AppTokens.ink,
                            ),
                          ),
                          const SizedBox(height: 14),
                          _SimpleCard(
                            title: l10n.onb_welcome_simpleTitle,
                            body: l10n.onb_welcome_simpleBody,
                            stateLabel: simple
                                ? l10n.onb_welcome_on
                                : l10n.onb_welcome_off,
                            on: simple,
                            onChanged: (v) =>
                                _toggleSimple(v, l10n.onb_welcome_title),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            l10n.onb_welcome_later,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppTokens.muted,
                            ),
                          ),
                          const Spacer(),
                          const SizedBox(height: 16),
                          BigButton(
                            key: const Key('welcome_continue'),
                            label: l10n.onb_welcome_continue,
                            icon: Icons.chevron_right,
                            onPressed: _continue,
                          ),
                          const SizedBox(height: 28),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppTokens.green,
              borderRadius: BorderRadius.circular(24),
            ),
            child: const ExcludeSemantics(
              child:
                  Icon(Icons.home_outlined, size: 42, color: AppTokens.white),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            title,
            style: const TextStyle(
              fontSize: 30,
              fontWeight: FontWeight.w700,
              color: AppTokens.green,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: const TextStyle(fontSize: 16, color: AppTokens.muted),
          ),
        ],
      );
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Semantics(
        header: true,
        child: Text(
          text,
          style: const TextStyle(
            fontSize: 19,
            fontWeight: FontWeight.w700,
            color: AppTokens.ink,
          ),
        ),
      );
}

class _ChipRow extends StatelessWidget {
  const _ChipRow({required this.first, required this.second});

  final Widget first;
  final Widget second;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Expanded(child: first),
          const SizedBox(width: 10),
          Expanded(child: second),
        ],
      );
}

/// A choice chip: the selected one shows a tick and a green fill, never colour alone.
class _Chip extends StatelessWidget {
  const _Chip({
    super.key,
    required this.label,
    required this.semantic,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final String semantic;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = selected ? AppTokens.white : AppTokens.ink;
    return Semantics(
      button: true,
      selected: selected,
      label: '$label, $semantic',
      excludeSemantics: true,
      onTap: onTap,
      child: Material(
        color: selected ? AppTokens.green : AppTokens.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(
            color: selected ? AppTokens.green : AppTokens.border,
            width: 2,
          ),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: SizedBox(
            height: 56,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (selected) ...[
                  Icon(Icons.check, size: 26, color: fg),
                  const SizedBox(width: 6),
                ],
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: fg,
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

class _SimpleCard extends StatelessWidget {
  const _SimpleCard({
    required this.title,
    required this.body,
    required this.stateLabel,
    required this.on,
    required this.onChanged,
  });

  final String title;
  final String body;
  final String stateLabel;
  final bool on;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppTokens.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppTokens.border, width: 2),
        ),
        child: Row(
          children: [
            const ExcludeSemantics(
              child: Icon(Icons.mic_none, size: 34, color: AppTokens.green),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w700,
                      color: AppTokens.ink,
                    ),
                  ),
                  Text(
                    body,
                    style: const TextStyle(
                      fontSize: 14,
                      height: 1.35,
                      color: AppTokens.muted,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Semantics(
              toggled: on,
              label: title,
              value: stateLabel,
              excludeSemantics: true,
              onTap: () => onChanged(!on),
              child: GestureDetector(
                key: const Key('welcome_simple_switch'),
                behavior: HitTestBehavior.opaque,
                onTap: () => onChanged(!on),
                child: SizedBox(
                  width: 60,
                  height: 48,
                  child: Center(
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 120),
                      width: 60,
                      height: 34,
                      padding: const EdgeInsets.all(4),
                      alignment:
                          on ? Alignment.centerRight : Alignment.centerLeft,
                      decoration: BoxDecoration(
                        color: on ? AppTokens.green : AppTokens.switchOff,
                        borderRadius: BorderRadius.circular(17),
                      ),
                      child: Container(
                        width: 26,
                        height: 26,
                        decoration: const BoxDecoration(
                          color: AppTokens.white,
                          shape: BoxShape.circle,
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
