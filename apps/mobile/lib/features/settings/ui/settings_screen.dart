import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/redirects.dart';
import '../../../core/l10n/l10n_x.dart';
import '../../../core/money/money_format.dart';
import '../../../core/theme/tokens.dart';
import '../../../data/sync/nearby_transport.dart';
import '../../../data/sync/p2p_transport.dart';
import '../../../data/sync/peer_sync_engine.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../../presentation/providers/providers.dart';
import '../../family/state/active_family.dart';
import '../state/preferences_controller.dart';
import 'profile_screen.dart' show dayPeriod, reminderWords;

/// Asks for a time of day; null when cancelled. Tests override it.
final settingsTimePickerProvider =
    Provider<
      Future<TimeOfDay?> Function(BuildContext context, TimeOfDay initial)
    >(
      (ref) =>
          (context, initial) => showTimePicker(
            context: context,
            initialTime: initial,
            initialEntryMode: TimePickerEntryMode.dial,
          ),
    );

TimeOfDay _parse(String hhmm, TimeOfDay fallback) {
  final p = hhmm.split(':');
  final h = p.length == 2 ? int.tryParse(p[0]) : null;
  final m = p.length == 2 ? int.tryParse(p[1]) : null;
  if (h == null || m == null) return fallback;
  return TimeOfDay(hour: h, minute: m);
}

String _hhmm(TimeOfDay t) =>
    '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

/// "রাত ১০টা" on the hour, "রাত ১০:৩০" otherwise.
String timeWords(AppLocalizations l10n, String hhmm, NumeralStyle style) {
  final t = _parse(hhmm, const TimeOfDay(hour: 22, minute: 0));
  if (t.minute != 0) return reminderWords(l10n, hhmm, style);
  final h12 = t.hour % 12 == 0 ? 12 : t.hour % 12;
  var hour = '$h12';
  if (style == NumeralStyle.bangla) hour = toBanglaDigits(hour);
  return l10n.settings_hourSharp(dayPeriod(l10n, t.hour), hour);
}

/// B6: one settings list (FR-AUTH-04 links, FR-NOTIF-05 quiet hours, FR-VOICE-09 Simple mode,
/// FR-SYNC-04 nearby sync). Board: Settings.dc.html. Route `/settings`.
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  PeerSyncEngine? _engine;
  String _status = '';

  @override
  void dispose() {
    _engine?.stop();
    super.dispose();
  }

  /// Both phones show the same short code; connect only if the people holding them agree it matches.
  Future<bool> _approve(PeerInfo peer) async {
    if (!mounted) return false;
    final ok = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: Text(ctx.l10n.sync_nearby_askTitle),
        content: Text(ctx.l10n.sync_nearby_askBody(peer.name, peer.authCode)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(ctx.l10n.common_no),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(ctx.l10n.common_yes),
          ),
        ],
      ),
    );
    return ok ?? false;
  }

  Future<void> _toggleNearby() async {
    if (_engine != null) {
      await _engine!.stop();
      if (!mounted) return;
      setState(() {
        _engine = null;
        _status = '';
      });
      return;
    }
    final family = ref.read(activeFamilyProvider);
    if (family == null) {
      setState(() => _status = context.l10n.sync_nearby_needLogin);
      return;
    }
    final engine = PeerSyncEngine(
      store: ref.read(localStoreProvider),
      transport: NearbyTransport(),
      familyId: family.id,
      approve: _approve,
      onStatus: (m) {
        if (!mounted) return;
        setState(() => _status = m);
        ref.read(appStateProvider.notifier).reload();
      },
    );
    try {
      await engine.start();
      if (mounted) setState(() => _engine = engine);
    } catch (e) {
      if (mounted) {
        setState(() => _status = context.l10n.sync_nearby_failed);
      }
    }
  }

  void _failed() {
    if (!mounted) return;
    ScaffoldMessenger.maybeOf(
      context,
    )?.showSnackBar(SnackBar(content: Text(context.l10n.settings_saveFailed)));
  }

  Future<void> _run(Future<bool> change) async {
    if (!await change) _failed();
  }

  void _go(String route) => GoRouter.maybeOf(context)?.push(route);

  Future<void> _pickReminder(Preferences prefs) async {
    final picked = await ref.read(settingsTimePickerProvider)(
      context,
      _parse(prefs.reminderTime, const TimeOfDay(hour: 21, minute: 0)),
    );
    if (picked == null || !mounted || _hhmm(picked) == prefs.reminderTime) {
      return;
    }
    await _run(
      ref.read(preferencesProvider.notifier).setReminderTime(_hhmm(picked)),
    );
  }

  Future<void> _quietSheet(Preferences prefs) async {
    final result = await showModalBottomSheet<(String, String)>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTokens.bg,
      builder: (_) => _QuietSheet(
        start: prefs.quietStart,
        end: prefs.quietEnd,
        style: prefs.numeralStyle,
      ),
    );
    if (result == null || !mounted) return;
    if (result.$1 == prefs.quietStart && result.$2 == prefs.quietEnd) return;
    await _run(
      ref
          .read(preferencesProvider.notifier)
          .setQuietHours(result.$1, result.$2),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final prefs = ref.watch(preferencesProvider);
    final ctl = ref.read(preferencesProvider.notifier);
    return Scaffold(
      backgroundColor: AppTokens.bg,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 8, 0),
              child: Row(
                children: [
                  IconButton(
                    tooltip: l10n.profile_back,
                    constraints: const BoxConstraints.tightFor(
                      width: 56,
                      height: 56,
                    ),
                    icon: Icon(
                      Icons.chevron_left,
                      size: 32,
                      semanticLabel: l10n.profile_back,
                    ),
                    onPressed: () => Navigator.of(context).maybePop(),
                  ),
                  Expanded(
                    child: Semantics(
                      header: true,
                      child: Text(
                        l10n.settings_title,
                        style: const TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w700,
                          color: AppTokens.green,
                        ),
                      ),
                    ),
                  ),
                  IconButton(
                    key: const Key('settings_profile'),
                    tooltip: l10n.profile_title,
                    constraints: const BoxConstraints.tightFor(
                      width: 56,
                      height: 56,
                    ),
                    icon: Icon(
                      Icons.person_outline,
                      size: 30,
                      semanticLabel: l10n.profile_title,
                    ),
                    onPressed: () => _go(Routes.profile),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            _Card(
              children: [
                _Row(
                  tint: AppTokens.greenTint,
                  title: l10n.settings_simple,
                  titleColor: AppTokens.deepGreen,
                  titleWeight: FontWeight.w700,
                  titleSize: 19,
                  body: l10n.settings_simpleBody,
                  bodyColor: AppTokens.deepGreen,
                  trailing: _Switch(
                    key: const Key('settings_simple_switch'),
                    label: l10n.settings_simple,
                    on: prefs.simpleMode,
                    onChanged: (v) => _run(ctl.setSimpleMode(v)),
                  ),
                ),
                _Row(
                  title: l10n.settings_language,
                  trailing: _Choices(
                    keyPrefix: 'settings_lang',
                    options: [('bn', 'বাংলা', 'বাংলা'), ('en', 'English', l10n.settings_langEnglishLabel)],
                    selected: prefs.locale.languageCode,
                    onSelect: (v) => _run(ctl.setLocale(Locale(v))),
                  ),
                ),
                _Row(
                  title: l10n.settings_numbers,
                  trailing: _Choices(
                    keyPrefix: 'settings_num',
                    options: [('bangla', '১২৩', '১২৩'), ('latin', '123', l10n.settings_numLatinLabel)],
                    selected: prefs.numeralStyle == NumeralStyle.bangla
                        ? 'bangla'
                        : 'latin',
                    onSelect: (v) => _run(
                      ctl.setNumeralStyle(
                        v == 'bangla'
                            ? NumeralStyle.bangla
                            : NumeralStyle.latin,
                      ),
                    ),
                  ),
                ),
                _Row(
                  key: const Key('settings_reminder'),
                  title: l10n.settings_remind,
                  body: l10n.profile_reminderAt(
                    reminderWords(l10n, prefs.reminderTime, prefs.numeralStyle),
                  ),
                  trailing: const _Chevron(),
                  onTap: () => _pickReminder(prefs),
                ),
                _Row(
                  key: const Key('settings_quiet'),
                  title: l10n.settings_vibration,
                  body: l10n.settings_quietSubtitle(
                    timeWords(l10n, prefs.quietStart, prefs.numeralStyle),
                    timeWords(l10n, prefs.quietEnd, prefs.numeralStyle),
                  ),
                  trailing: const _Chevron(),
                  onTap: () => _quietSheet(prefs),
                  last: true,
                ),
              ],
            ),
            const SizedBox(height: 12),
            _Card(
              children: [
                _Row(
                  title: l10n.sync_nearby_title,
                  body: _status.isEmpty ? null : _status,
                  trailing: _Switch(
                    key: const Key('settings_nearby_switch'),
                    label: l10n.sync_nearby_title,
                    on: _engine != null,
                    onChanged: (_) => _toggleNearby(),
                  ),
                ),
                _Row(
                  key: const Key('settings_csv'),
                  title: l10n.settings_csv,
                  trailing: const _Chevron(),
                  onTap: () => _go(Routes.reports),
                ),
                _Row(
                  key: const Key('settings_catalog'),
                  title: l10n.settings_catalog,
                  trailing: const _Chevron(),
                  onTap: () => _go(Routes.accounts),
                ),
                _Row(
                  key: const Key('settings_tutorial'),
                  title: l10n.settings_tutorial_title,
                  trailing: const Icon(
                    Icons.volume_up_outlined,
                    size: 26,
                    color: AppTokens.green,
                  ),
                  onTap: () => _go(Routes.tutorial),
                  last: true,
                ),
              ],
            ),
            const SizedBox(height: 12),
            _Card(
              children: [
                _Row(
                  key: const Key('settings_privacy'),
                  title: l10n.settings_privacy,
                  trailing: const _Chevron(),
                  onTap: () => _go(Routes.consentPolicy),
                ),
                _Row(
                  key: const Key('settings_delete'),
                  title: l10n.settings_delete,
                  titleColor: AppTokens.danger,
                  titleWeight: FontWeight.w700,
                  body: l10n.settings_deleteBody,
                  trailing: const _Chevron(color: AppTokens.danger),
                  onTap: () => _go(Routes.deleteAccount),
                  last: true,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Two big time buttons and a save button. Pops `(start, end)` as `HH:mm`.
class _QuietSheet extends ConsumerStatefulWidget {
  const _QuietSheet({
    required this.start,
    required this.end,
    required this.style,
  });

  final String start;
  final String end;
  final NumeralStyle style;

  @override
  ConsumerState<_QuietSheet> createState() => _QuietSheetState();
}

class _QuietSheetState extends ConsumerState<_QuietSheet> {
  late String _start = widget.start;
  late String _end = widget.end;

  Future<void> _pick(bool isStart) async {
    final cur = isStart ? _start : _end;
    final picked = await ref.read(settingsTimePickerProvider)(
      context,
      _parse(cur, TimeOfDay(hour: isStart ? 22 : 6, minute: 0)),
    );
    if (picked == null || !mounted) return;
    setState(() => isStart ? _start = _hhmm(picked) : _end = _hhmm(picked));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(
              header: true,
              child: Text(
                l10n.settings_quietTitle,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: AppTokens.ink,
                ),
              ),
            ),
            const SizedBox(height: 16),
            _TimeButton(
              key: const Key('quiet_start'),
              label: l10n.settings_quietFrom,
              value: timeWords(l10n, _start, widget.style),
              onTap: () => _pick(true),
            ),
            const SizedBox(height: 12),
            _TimeButton(
              key: const Key('quiet_end'),
              label: l10n.settings_quietTo,
              value: timeWords(l10n, _end, widget.style),
              onTap: () => _pick(false),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: AppTokens.primaryMin,
              child: FilledButton(
                key: const Key('quiet_save'),
                onPressed: () => Navigator.of(context).pop((_start, _end)),
                child: Text(
                  l10n.settings_quietSave,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
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

class _TimeButton extends StatelessWidget {
  const _TimeButton({
    super.key,
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: '$label $value',
    excludeSemantics: true,
    onTap: onTap,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        constraints: const BoxConstraints(minHeight: 72),
        padding: const EdgeInsets.symmetric(horizontal: 18),
        decoration: BoxDecoration(
          color: AppTokens.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppTokens.green, width: 2),
        ),
        child: Row(
          children: [
            Text(
              label,
              style: const TextStyle(fontSize: 18, color: AppTokens.muted),
            ),
            const Spacer(),
            Text(
              value,
              style: const TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w700,
                color: AppTokens.ink,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _Chevron extends StatelessWidget {
  const _Chevron({this.color});

  final Color? color;

  @override
  Widget build(BuildContext context) =>
      Icon(Icons.chevron_right, size: 28, color: color);
}

class _Card extends StatelessWidget {
  const _Card({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.symmetric(horizontal: 20),
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      color: AppTokens.white,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: AppTokens.border),
    ),
    child: Column(children: children),
  );
}

class _Row extends StatelessWidget {
  const _Row({
    super.key,
    required this.title,
    required this.trailing,
    this.body,
    this.tint,
    this.titleColor = AppTokens.ink,
    this.bodyColor = AppTokens.muted,
    this.titleWeight = FontWeight.w600,
    this.titleSize = 18,
    this.onTap,
    this.last = false,
  });

  final String title;
  final String? body;
  final Widget trailing;
  final Color? tint;
  final Color titleColor;
  final Color bodyColor;
  final FontWeight titleWeight;
  final double titleSize;
  final VoidCallback? onTap;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final row = Container(
      constraints: const BoxConstraints(minHeight: 68),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: tint,
        border: last
            ? null
            : const Border(bottom: BorderSide(color: AppTokens.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: titleSize,
                    fontWeight: titleWeight,
                    color: titleColor,
                  ),
                ),
                if (body != null)
                  Text(body!, style: TextStyle(fontSize: 14, color: bodyColor)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          trailing,
        ],
      ),
    );
    if (onTap == null) return row;
    return Semantics(
      button: true,
      label: title,
      excludeSemantics: true,
      onTap: onTap,
      child: InkWell(onTap: onTap, child: row),
    );
  }
}

class _Choices extends StatelessWidget {
  const _Choices({
    required this.keyPrefix,
    required this.options,
    required this.selected,
    required this.onSelect,
  });

  final String keyPrefix;
  final List<(String, String, String)> options;
  final String selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      for (final (id, label, semantic) in options)
        Semantics(
          button: true,
          selected: id == selected,
          label: semantic,
          excludeSemantics: true,
          onTap: () => onSelect(id),
          child: GestureDetector(
            key: Key('${keyPrefix}_$id'),
            behavior: HitTestBehavior.opaque,
            onTap: () => onSelect(id),
            child: Container(
              constraints: const BoxConstraints(minHeight: 48),
              alignment: Alignment.center,
              margin: EdgeInsets.only(left: id == options.first.$1 ? 0 : 6),
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: id == selected ? AppTokens.green : AppTokens.border,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: id == selected
                      ? FontWeight.w700
                      : FontWeight.w600,
                  color: id == selected ? AppTokens.white : AppTokens.ink,
                ),
              ),
            ),
          ),
        ),
    ],
  );
}

/// The 56 x 32 switch of the board, with a 48 dp tall touch area.
class _Switch extends StatelessWidget {
  const _Switch({
    super.key,
    required this.label,
    required this.on,
    required this.onChanged,
  });

  final String label;
  final bool on;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) => Semantics(
    toggled: on,
    label: label,
    excludeSemantics: true,
    onTap: () => onChanged(!on),
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => onChanged(!on),
      child: SizedBox(
        width: 56,
        height: 48,
        child: Center(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 120),
            width: 56,
            height: 32,
            padding: const EdgeInsets.all(4),
            alignment: on ? Alignment.centerRight : Alignment.centerLeft,
            decoration: BoxDecoration(
              color: on ? AppTokens.green : AppTokens.switchOff,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Container(
              width: 24,
              height: 24,
              decoration: const BoxDecoration(
                color: AppTokens.white,
                shape: BoxShape.circle,
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
