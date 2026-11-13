import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/redirects.dart';
import '../../../core/l10n/l10n_x.dart';
import '../../../core/money/money_format.dart';
import '../../../core/push/push_router.dart';
import '../../../core/push/push_service.dart';
import '../../../core/theme/tokens.dart';
import '../../../domain/models/api/engage.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../../presentation/providers/auth_provider.dart';
import '../../../ui/app_header.dart';
import '../../../ui/empty_state.dart';
import '../../../ui/listen_button.dart';
import '../../home/state/home_providers.dart';
import '../state/inbox_providers.dart';
import '../state/reminder_scheduler.dart';

/// What is read aloud for an item (FR-NOTIF-04).
String speechFor(InboxItem i) => i.speechText ?? '${i.title}। ${i.body}';

/// "আজ সকালে", "গতকাল", "৩ দিন আগে" (Asia/Dhaka).
String timeInWords(
  AppLocalizations l10n,
  String createdAtIso,
  DateTime nowUtc,
) {
  final at = DateTime.parse(createdAtIso).toUtc().add(const Duration(hours: 6));
  final now = nowUtc.toUtc().add(const Duration(hours: 6));
  final days = DateTime.utc(now.year, now.month, now.day)
      .difference(DateTime.utc(at.year, at.month, at.day))
      .inDays;
  if (days <= 0) return l10n.notif_timeToday(_period(l10n, at.hour));
  if (days == 1) return l10n.notif_timeYesterday;
  return l10n.notif_timeDaysAgo(toBanglaDigits('$days'));
}

String _period(AppLocalizations l10n, int hour) {
  if (hour >= 5 && hour < 11) return l10n.notif_periodMorning;
  if (hour >= 11 && hour < 16) return l10n.notif_periodNoon;
  if (hour >= 16 && hour < 18) return l10n.notif_periodAfternoon;
  if (hour >= 18 && hour < 20) return l10n.notif_periodEvening;
  return l10n.notif_periodNight;
}

String _clockWords(AppLocalizations l10n, String hhmm) {
  final t = parseReminderTime(hhmm);
  final h12 = t.hour % 12 == 0 ? 12 : t.hour % 12;
  final mm = t.minute.toString().padLeft(2, '0');
  return '${toBanglaDigits('$h12:$mm')} ${_period(l10n, t.hour)}';
}

(IconData, Color, Color) _tile(String kind) {
  switch (kind) {
    case 'budget':
      return (
        Icons.warning_amber_rounded,
        AppTokens.amberTint,
        AppTokens.amberInk
      );
    case 'invite':
      return (Icons.person_add_alt_1, AppTokens.greenTint, AppTokens.deepGreen);
    case 'reminder':
      return (
        Icons.notifications_active_outlined,
        AppTokens.greenTint,
        AppTokens.deepGreen
      );
    case 'bill':
      return (
        Icons.receipt_long_outlined,
        AppTokens.amberTint,
        AppTokens.amberInk
      );
    case 'nudge':
      return (Icons.vibration, AppTokens.amberTint, AppTokens.amberInk);
    case 'msg':
      return (
        Icons.chat_bubble_outline,
        AppTokens.greenTint,
        AppTokens.deepGreen
      );
    case 'call':
      return (Icons.call_outlined, AppTokens.greenTint, AppTokens.deepGreen);
  }
  return (Icons.notifications_none, AppTokens.greenTint, AppTokens.deepGreen);
}

/// F3: everything the app told you, each item readable aloud. Board: Notifications.dc.html.
/// Route `/notifications`.
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  bool _listeningAll = false;

  @override
  void dispose() {
    _listeningAll = false;
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      await ref.read(inboxRepositoryProvider).refresh();
    } catch (_) {
      // Offline: the cached list stays.
    }
  }

  Future<void> _listenAll(List<InboxItem> items) async {
    final voice = ref.read(voiceServiceProvider);
    final repo = ref.read(inboxRepositoryProvider);
    final pause = ref.read(listenAllPauseProvider);
    final unread = items.where((i) => i.readAt == null).toList();
    if (unread.isEmpty) return;
    setState(() => _listeningAll = true);
    try {
      for (var n = 0; n < unread.length && _listeningAll; n++) {
        await voice.speak(speechFor(unread[n]));
        if (!_listeningAll) break;
        await repo.markRead([unread[n].id]);
        if (n < unread.length - 1) await Future<void>.delayed(pause);
      }
    } finally {
      if (mounted) setState(() => _listeningAll = false);
    }
  }

  Future<void> _stop() async {
    setState(() => _listeningAll = false);
    await ref.read(voiceServiceProvider).stopSpeaking();
  }

  Future<void> _open(InboxItem i) async {
    await ref.read(inboxRepositoryProvider).markRead([i.id]);
    final data = <String, String>{
      for (final e in (i.data ?? const <String, dynamic>{}).entries)
        e.key: '${e.value}',
      'type': i.kind,
      'id': (i.data?['id'] ?? i.id).toString(),
    };
    final route = routeFor(PushMessage(data));
    if (route != null && mounted && route != Routes.notifications) {
      unawaited(context.push(route));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final items = ref.watch(inboxItemsProvider).valueOrNull ?? const [];
    final prefs = ref.watch(notificationPreferencesProvider).valueOrNull;
    final clock = ref.watch(homeClockProvider);
    final now = clock();
    final quiet = inQuietHours(
      dhakaNow(clock),
      prefs?.quietStart,
      prefs?.quietEnd,
    );
    final hasUnread = items.any((i) => i.readAt == null);

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            AppHeader(
              title: l10n.notif_title,
              actions: [
                if (_listeningAll)
                  _HeaderButton(
                    icon: Icons.stop_circle_outlined,
                    label: l10n.notif_stop,
                    onTap: _stop,
                  )
                else if (hasUnread)
                  _HeaderButton(
                    icon: Icons.volume_up,
                    label: l10n.notif_listenAll,
                    onTap: () => _listenAll(items),
                  ),
              ],
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _refresh,
                child: items.isEmpty
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                        children: [
                          if (quiet) _QuietCard(text: l10n.notif_quietNote),
                          SizedBox(
                            height: 360,
                            child: EmptyState(
                              icon: Icons.notifications_none,
                              message: l10n.notif_empty,
                              speakHint: false,
                            ),
                          ),
                        ],
                      )
                    : ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                        children: [
                          if (quiet) _QuietCard(text: l10n.notif_quietNote),
                          for (final i in items) ...[
                            _Row(
                              item: i,
                              when: timeInWords(l10n, i.createdAt, now),
                              onTap: () => _open(i),
                            ),
                            const SizedBox(height: 10),
                          ],
                          const SizedBox(height: 6),
                          _SettingsLink(
                            text: l10n.notif_reminderTime(
                              _clockWords(
                                l10n,
                                prefs?.dailyReminderTime ?? defaultReminderTime,
                              ),
                            ),
                            label: l10n.notif_changeSettings,
                            onTap: () => context.push(Routes.settings),
                          ),
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeaderButton extends StatelessWidget {
  const _HeaderButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Semantics(
        container: true,
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
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 48, minWidth: 48),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(icon, size: 24, color: AppTokens.deepGreen),
                    const SizedBox(width: 6),
                    Text(
                      label,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppTokens.deepGreen,
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
}

class _QuietCard extends StatelessWidget {
  const _QuietCard({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(0, 4, 0, 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTokens.amberTint,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          const Icon(Icons.bedtime_outlined, color: AppTokens.amberInk),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(fontSize: 15, color: AppTokens.amberInk),
            ),
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.item, required this.when, required this.onTap});

  final InboxItem item;
  final String when;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final unread = item.readAt == null;
    final (icon, bg, fg) = _tile(item.kind);
    return Material(
      color: scheme.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: scheme.outlineVariant),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(icon, color: fg),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (unread)
                          Container(
                            key: const ValueKey('unread-dot'),
                            width: 10,
                            height: 10,
                            margin: const EdgeInsetsDirectional.only(end: 6),
                            decoration: const BoxDecoration(
                              color: AppTokens.green,
                              shape: BoxShape.circle,
                            ),
                          ),
                        Expanded(
                          child: Text(
                            item.title,
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight:
                                  unread ? FontWeight.w700 : FontWeight.w500,
                              color: scheme.onSurface,
                            ),
                          ),
                        ),
                      ],
                    ),
                    Text(
                      item.body,
                      style: TextStyle(
                        fontSize: 15,
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                    Text(
                      when,
                      style: TextStyle(
                        fontSize: 13,
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              ListenButton(text: speechFor(item), compact: true),
            ],
          ),
        ),
      ),
    );
  }
}

class _SettingsLink extends StatelessWidget {
  const _SettingsLink({
    required this.text,
    required this.label,
    required this.onTap,
  });

  final String text;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(
      children: [
        Expanded(
          child: Text(
            text,
            style: TextStyle(fontSize: 15, color: scheme.onSurfaceVariant),
          ),
        ),
        TextButton(
          onPressed: onTap,
          style: TextButton.styleFrom(minimumSize: const Size(48, 48)),
          child: Text(label, style: const TextStyle(fontSize: 16)),
        ),
      ],
    );
  }
}
