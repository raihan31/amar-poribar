import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/redirects.dart';
import '../../../core/l10n/l10n_x.dart';
import '../../../core/money/money.dart';
import '../../../core/money/money_format.dart';
import '../../../core/money/numeral_style_provider.dart';
import '../../../core/speech/bangla_words.dart';
import '../../../core/theme/dark_tokens.dart';
import '../../../core/theme/tokens.dart';
import '../../../domain/models/member.dart';
import '../../../domain/models/role.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../../ui/banner_strip.dart';
import '../../../ui/big_button.dart';
import '../../../ui/listen_button.dart';
import '../../../ui/member_avatar.dart';
import '../../family/state/family_providers.dart';
import '../../notifications/state/inbox_providers.dart';
import '../data/home_repository.dart';
import '../state/home_providers.dart';
import 'simple_home_screen.dart';

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

/// "নভেম্বরে", "জানুয়ারিতে", "জুলাইয়ে", "মে মাসে".
String monthLocative(int month) {
  final n = _months[month - 1];
  if (n.endsWith('ি') || n.endsWith('ী') || n.endsWith('া')) return '$nতে';
  if (n.endsWith('ই')) return '$nয়ে';
  if (n.endsWith('ে')) return '$n মাসে';
  return '$nে';
}

/// Which greeting to use for a wall-clock hour in Asia/Dhaka.
String greeting(AppLocalizations l10n, int hour, String name) {
  if (hour >= 5 && hour < 11) return l10n.home_greetMorning(name);
  if (hour >= 11 && hour < 16) return l10n.home_greetNoon(name);
  if (hour >= 16 && hour < 20) return l10n.home_greetEvening(name);
  return l10n.home_greetNight(name);
}

class _Palette {
  const _Palette._(
    this.card,
    this.onCard,
    this.warnBg,
    this.warnFg,
    this.border,
    this.surface,
    this.danger,
    this.buzzBg,
    this.buzzFg,
    this.tileBg,
    this.onTile,
  );

  final Color card;
  final Color onCard;
  final Color warnBg;
  final Color warnFg;
  final Color border;
  final Color surface;
  final Color danger;
  final Color buzzBg;
  final Color buzzFg;
  final Color tileBg;
  final Color onTile;

  factory _Palette.of(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return dark
        ? const _Palette._(
            DarkTokens.greenTint,
            DarkTokens.ink,
            DarkTokens.surface,
            DarkTokens.amber,
            DarkTokens.border,
            DarkTokens.surface,
            DarkTokens.danger,
            DarkTokens.surface,
            DarkTokens.amber,
            DarkTokens.green,
            DarkTokens.bg,
          )
        : const _Palette._(
            AppTokens.green,
            AppTokens.white,
            AppTokens.amberTint,
            AppTokens.amberInk,
            AppTokens.border,
            AppTokens.white,
            AppTokens.danger,
            AppTokens.amberTint,
            AppTokens.amberInk,
            AppTokens.green,
            AppTokens.white,
          );
  }
}

/// Home: month spending, budget warning, the big speak button, buzz/chat/video, family and latest
/// activity (FR-HOME-01). Board: Main.dc.html. Route `/home`, tab 0.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(homeVariantProvider) == HomeVariant.simple) {
      return const SimpleHomeScreen();
    }
    return const _NormalHome();
  }
}

class _NormalHome extends ConsumerWidget {
  const _NormalHome();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final pal = _Palette.of(context);
    final scheme = Theme.of(context).colorScheme;
    final role = ref.watch(currentRoleProvider);
    final isViewer = role == FamilyRole.viewer &&
        ref.watch(currentRoleFutureProvider).hasValue;
    final offline = ref.watch(homeOfflineProvider);
    final members = ref.watch(membersProvider).valueOrNull ?? const <Member>[];
    final me = ref.watch(myUserIdProvider).valueOrNull;
    final myName = members
        .where((m) => m.userId == me)
        .map((m) => m.name)
        .followedBy(const ['']).first;
    final now = dhakaNow(ref.watch(homeClockProvider));
    final warning = ref.watch(topBudgetWarningProvider);
    final recipient = ref.watch(budgetRecipientProvider);

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            if (offline)
              BannerStrip(kind: BannerKind.warn, text: l10n.home_offline),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () => ref.read(homeRefreshProvider)(),
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _Header(
                        greeting: greeting(l10n, now.hour, myName),
                        pal: pal,
                      ),
                      const SizedBox(height: 10),
                      _SummaryCard(now: now, pal: pal),
                      if (warning != null) ...[
                        const SizedBox(height: 8),
                        _WarningStrip(
                          warning: warning,
                          recipient: recipient,
                          pal: pal,
                        ),
                      ],
                      const SizedBox(height: 10),
                      if (isViewer)
                        _RemitCard(pal: pal)
                      else
                        _SpeakButton(
                          label: l10n.home_speakExpense,
                          onTap: () => context.push(Routes.add),
                        ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: _Tile(
                              label: l10n.home_tileBuzz,
                              icon: Icons.vibration,
                              bg: pal.buzzBg,
                              fg: pal.buzzFg,
                              onTap: () => context.push(Routes.buzz),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _Tile(
                              label: l10n.home_tileTalk,
                              icon: Icons.chat_bubble_outline,
                              bg: pal.tileBg,
                              fg: pal.onTile,
                              onTap: () => context.go(Routes.talk),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _Tile(
                              label: l10n.home_tileVideo,
                              icon: Icons.videocam_outlined,
                              bg: pal.tileBg,
                              fg: pal.onTile,
                              onTap: () => context.push(_callPicker()),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      _AvatarRow(members: members, scheme: scheme),
                      const SizedBox(height: 10),
                      _Activity(pal: pal, members: members),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _callPicker([String? to]) => Uri(
      path: '/call/new',
      queryParameters: to == null ? null : {'to': to},
    ).toString();

class _Header extends ConsumerWidget {
  const _Header({required this.greeting, required this.pal});

  final String greeting;
  final _Palette pal;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final unread = ref.watch(unreadCountProvider).valueOrNull ?? 0;
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                greeting,
                style: TextStyle(fontSize: 14, color: scheme.onSurfaceVariant),
              ),
              Text(
                context.l10n.common_appName,
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                  color: scheme.primary,
                ),
              ),
            ],
          ),
        ),
        Semantics(
          button: true,
          label: unread > 0
              ? context.l10n.notif_bell(toBanglaDigits('$unread'))
              : context.l10n.notif_title,
          excludeSemantics: true,
          child: Material(
            color: pal.surface,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => context.push(Routes.notifications),
              child: SizedBox(
                width: 48,
                height: 48,
                child: Stack(
                  alignment: Alignment.center,
                  clipBehavior: Clip.none,
                  children: [
                    Icon(
                      Icons.notifications_none,
                      size: 26,
                      color: scheme.onSurface,
                    ),
                    if (unread > 0)
                      PositionedDirectional(
                        top: 2,
                        end: 0,
                        child: Container(
                          key: const ValueKey('bell-count'),
                          constraints: const BoxConstraints(
                            minWidth: 20,
                            minHeight: 20,
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 5),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: pal.danger,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            toBanglaDigits('$unread'),
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 4),
        Semantics(
          button: true,
          label: context.l10n.home_settings,
          excludeSemantics: true,
          child: Material(
            color: pal.surface,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => context.push(Routes.settings),
              child: SizedBox(
                width: 56,
                height: 56,
                child: Icon(
                  Icons.settings_outlined,
                  size: 28,
                  color: scheme.onSurface,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _SummaryCard extends ConsumerWidget {
  const _SummaryCard({required this.now, required this.pal});

  final DateTime now;
  final _Palette pal;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final style = ref.watch(numeralStyleProvider);
    final summary = ref.watch(homeSummaryProvider).valueOrNull;
    final spent = summary?.current.expense ?? Money.zero;
    final change = summary?.change ?? Money.zero;
    String fmt(Money m) => formatMoney(Money(m.paisa.abs()), style: style);
    final changeText = change.paisa == 0
        ? l10n.home_changeSame
        : change.isNegative
            ? l10n.home_changeLess(fmt(change))
            : l10n.home_changeMore(fmt(change));
    final monthLabel = l10n.home_monthSpent(monthLocative(now.month));
    final speech = l10n.home_summarySpeech(
      monthLocative(now.month),
      amountInWords(spent.paisa),
      changeText,
    );
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: pal.card,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  monthLabel,
                  style: TextStyle(fontSize: 14, color: pal.onCard),
                ),
                Text(
                  fmt(spent),
                  style: TextStyle(
                    fontSize: 32,
                    height: 1.1,
                    fontWeight: FontWeight.w700,
                    color: pal.onCard,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  changeText,
                  style: TextStyle(fontSize: 14, color: pal.onCard),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          ListenButton(text: speech),
        ],
      ),
    );
  }
}

class _WarningStrip extends ConsumerWidget {
  const _WarningStrip({
    required this.warning,
    required this.recipient,
    required this.pal,
  });

  final TopBudgetWarning warning;
  final Member? recipient;
  final _Palette pal;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final style = ref.watch(numeralStyleProvider);
    var pct = '${warning.percent}%';
    if (style == NumeralStyle.bangla) pct = toBanglaDigits(pct);
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 8, 8, 8),
      decoration: BoxDecoration(
        color: pal.warnBg,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Icon(Icons.warning_amber_rounded, size: 24, color: pal.warnFg),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              l10n.home_budgetWarning(warning.name, pct),
              style: TextStyle(
                fontSize: 15,
                height: 1.25,
                fontWeight: FontWeight.w600,
                color: pal.warnFg,
              ),
            ),
          ),
          if (recipient != null)
            Semantics(
              button: true,
              label: l10n.home_notify(recipient!.name),
              excludeSemantics: true,
              child: Material(
                color: AppTokens.amber,
                shape: const StadiumBorder(),
                child: InkWell(
                  customBorder: const StadiumBorder(),
                  onTap: () => context.push(
                    Uri(
                      path: Routes.buzz,
                      queryParameters: {
                        'phrase': l10n.home_budgetPhrase,
                        'to': recipient!.userId,
                      },
                    ).toString(),
                  ),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 48),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Center(
                        widthFactor: 1,
                        child: Text(
                          l10n.home_notify(recipient!.name),
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppTokens.ink,
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

class _SpeakButton extends StatelessWidget {
  const _SpeakButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      identifier: 'primary',
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
          child: SizedBox(
            height: 84,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.mic, size: 40, color: AppTokens.ink),
                const SizedBox(width: 12),
                Flexible(
                  child: Text(
                    label,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w700,
                      color: AppTokens.ink,
                    ),
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

/// Viewers get the remittance card instead of the add buttons (T-MOB-59 fills it).
class _RemitCard extends StatelessWidget {
  const _RemitCard({required this.pal});

  final _Palette pal;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: pal.surface,
        border: Border.all(color: pal.border),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              l10n.home_remitTitle,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
          ),
          SizedBox(
            width: 120,
            child: BigButton(
              label: l10n.home_remitOpen,
              height: 56,
              onPressed: () => context.push(Routes.remit),
            ),
          ),
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.label,
    required this.icon,
    required this.bg,
    required this.fg,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color bg;
  final Color fg;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      button: true,
      label: label,
      excludeSemantics: true,
      onTap: onTap,
      child: Material(
        color: bg,
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: onTap,
          child: SizedBox(
            height: 84,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 30, color: fg),
                const SizedBox(height: 4),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 17,
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

class _AvatarRow extends StatelessWidget {
  const _AvatarRow({required this.members, required this.scheme});

  final List<Member> members;
  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final m in members)
                  Padding(
                    padding: const EdgeInsets.only(right: 10),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () => _openMemberSheet(context, m),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(minWidth: 56),
                        child: Column(
                          children: [
                            MemberAvatar(m: m, online: m.online),
                            const SizedBox(height: 2),
                            Text(
                              m.name,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 88,
          child: Text(
            context.l10n.home_legend,
            textAlign: TextAlign.end,
            style: TextStyle(
              fontSize: 12,
              height: 1.5,
              color: scheme.onSurfaceVariant,
            ),
          ),
        ),
      ],
    );
  }
}

void _openMemberSheet(BuildContext context, Member m) {
  final l10n = context.l10n;
  showModalBottomSheet<void>(
    context: context,
    builder: (sheet) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              m.name,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 12),
            BigButton(
              label: l10n.home_tileBuzz,
              icon: Icons.vibration,
              style: BigButtonStyle.amber,
              height: 56,
              onPressed: () {
                Navigator.of(sheet).pop();
                context.push(
                  Uri(path: Routes.buzz, queryParameters: {'to': m.userId})
                      .toString(),
                );
              },
            ),
            const SizedBox(height: 8),
            BigButton(
              label: l10n.home_tileTalk,
              icon: Icons.chat_bubble_outline,
              height: 56,
              onPressed: () {
                Navigator.of(sheet).pop();
                context.go(Routes.talk);
              },
            ),
            const SizedBox(height: 8),
            BigButton(
              label: l10n.home_tileVideo,
              icon: Icons.videocam_outlined,
              height: 56,
              onPressed: () {
                Navigator.of(sheet).pop();
                context.push(_callPicker(m.userId));
              },
            ),
          ],
        ),
      ),
    ),
  );
}

class _Activity extends ConsumerWidget {
  const _Activity({required this.pal, required this.members});

  final _Palette pal;
  final List<Member> members;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final style = ref.watch(numeralStyleProvider);
    final items = ref.watch(recentActivityProvider);
    String nameOf(String? id) => members
        .where((m) => m.userId == id)
        .map((m) => m.name)
        .followedBy([l10n.home_somebody]).first;
    String digits(String s) =>
        style == NumeralStyle.bangla ? toBanglaDigits(s) : s;

    Widget row(String text, {Widget? trailing, VoidCallback? onTap}) =>
        Material(
          color: pal.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: pal.border),
          ),
          child: InkWell(
            customBorder: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            onTap: onTap,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 48),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        text,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    if (trailing != null) trailing,
                  ],
                ),
              ),
            ),
          ),
        );

    if (items.isEmpty) {
      return row(l10n.home_activityEmpty);
    }
    return Column(
      children: [
        for (final a in items) ...[
          if (a.kind == ActivityKind.voice)
            row(
              l10n.home_activityVoice(
                nameOf(a.memberId),
                digits(
                  '${(a.voiceSeconds ?? 0) ~/ 60}:${((a.voiceSeconds ?? 0) % 60).toString().padLeft(2, '0')}',
                ),
              ),
              onTap: () => context.go(Routes.talk),
              trailing: Padding(
                padding: const EdgeInsets.only(left: 10),
                child: Material(
                  color: Theme.of(context).colorScheme.primary,
                  shape: const CircleBorder(),
                  child: SizedBox(
                    width: 48,
                    height: 48,
                    child: Icon(
                      Icons.play_arrow_rounded,
                      size: 28,
                      color: Theme.of(context).colorScheme.onPrimary,
                    ),
                  ),
                ),
              ),
            )
          else
            row(
              l10n.home_activityExpense(nameOf(a.memberId), a.note ?? ''),
              onTap: a.id == null
                  ? null
                  : () => context.push(Routes.txn.replaceFirst(':id', a.id!)),
              trailing: Text(
                formatMoney(Money(-(a.amountPaisa ?? 0)), style: style),
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: pal.danger,
                ),
              ),
            ),
          const SizedBox(height: 6),
        ],
      ],
    );
  }
}
