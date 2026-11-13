import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/redirects.dart';
import '../../../core/l10n/l10n_x.dart';
import '../../../core/money/money_format.dart';
import '../../../core/theme/tokens.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../../presentation/providers/providers.dart';
import '../data/profile_repository.dart';
import '../state/preferences_controller.dart';

const _nameMetaKey = 'profile_name';

/// The part of the day for hour [h] (0-23): "ভোর", "সকাল", "রাত"...
String dayPeriod(AppLocalizations l10n, int h) => h < 4
    ? l10n.profile_periodSmallHours
    : h < 6
        ? l10n.profile_periodDawn
        : h < 12
            ? l10n.profile_periodMorning
            : h < 15
                ? l10n.profile_periodNoon
                : h < 18
                    ? l10n.profile_periodAfternoon
                    : h < 20
                        ? l10n.profile_periodEvening
                        : l10n.profile_periodNight;

/// `21:00` as words: "রাত ৯:০০" in the chosen numeral style (FR-NOT-02).
String reminderWords(AppLocalizations l10n, String hhmm, NumeralStyle style) {
  final parts = hhmm.split(':');
  final h = int.tryParse(parts.first) ?? 21;
  final m = int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0;
  final h12 = h % 12 == 0 ? 12 : h % 12;
  var time = '$h12:${m.toString().padLeft(2, '0')}';
  if (style == NumeralStyle.bangla) time = toBanglaDigits(time);
  return l10n.profile_time(dayPeriod(l10n, h), time);
}

/// F8: name, language, numerals, Simple mode, reminder time and presence (FR-AUTH-04,
/// FR-PRES-02, FR-NOT-02). Board: Profile.dc.html. Route `/profile`.
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _nameCtl = TextEditingController();
  final _nameFocus = FocusNode();
  String _name = '';
  String _phone = '';

  @override
  void initState() {
    super.initState();
    _nameFocus.addListener(() {
      if (!_nameFocus.hasFocus) _commitName();
    });
    _load();
  }

  @override
  void dispose() {
    _nameCtl.dispose();
    _nameFocus.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final store = ref.read(localStoreProvider);
    final cached = await store.getMeta(_nameMetaKey);
    if (mounted && cached != null) _setName(cached);
    try {
      await ref.read(profileSyncProvider).flush();
      final me = await ref.read(profileRepositoryProvider).load();
      if (!mounted) return;
      setState(() => _phone = me.user.phone);
      if (!_nameFocus.hasFocus) _setName(me.user.name ?? '');
      await store.setMeta(_nameMetaKey, _name);
    } catch (_) {
      // Offline: the cached name stays.
    }
  }

  void _setName(String v) {
    _name = v;
    _nameCtl.text = v;
    if (mounted) setState(() {});
  }

  Future<void> _commitName() async {
    final next = _nameCtl.text.trim();
    if (next.isEmpty || next == _name) {
      _nameCtl.text = _name;
      return;
    }
    final prev = _name;
    setState(() => _name = next);
    await ref.read(localStoreProvider).setMeta(_nameMetaKey, next);
    final ok =
        await ref.read(profileSyncProvider).send(ProfilePatch(name: next));
    if (!ok && mounted) {
      _setName(prev);
      await ref.read(localStoreProvider).setMeta(_nameMetaKey, prev);
      _failed();
    }
  }

  void _failed() {
    if (!mounted) return;
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      SnackBar(content: Text(context.l10n.profile_saveFailed)),
    );
  }

  Future<void> _run(Future<bool> change) async {
    final ok = await change;
    if (!ok) _failed();
  }

  Future<void> _pickTime(Preferences prefs) async {
    final parts = prefs.reminderTime.split(':');
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: int.tryParse(parts.first) ?? 21,
        minute: int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0,
      ),
      initialEntryMode: TimePickerEntryMode.dial,
    );
    if (picked == null || !mounted) return;
    final hhmm =
        '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
    if (hhmm == prefs.reminderTime) return;
    await _run(ref.read(preferencesProvider.notifier).setReminderTime(hhmm));
  }

  void _go(String route) => GoRouter.maybeOf(context)?.push(route);

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final prefs = ref.watch(preferencesProvider);
    final ctl = ref.read(preferencesProvider.notifier);
    final initial = _name.isEmpty ? '' : String.fromCharCode(_name.runes.first);
    final colors = AppTokens.avatars[3];
    return Scaffold(
      backgroundColor: AppTokens.bg,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 20, 0),
              child: Row(
                children: [
                  IconButton(
                    tooltip: l10n.profile_back,
                    constraints: const BoxConstraints.tightFor(
                      width: 56,
                      height: 56,
                    ),
                    icon: const Icon(Icons.chevron_left, size: 32),
                    onPressed: () => Navigator.of(context).maybePop(),
                  ),
                  Expanded(
                    child: Semantics(
                      header: true,
                      child: Text(
                        l10n.profile_title,
                        style: const TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w700,
                          color: AppTokens.ink,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Center(
              child: Container(
                key: const Key('profile_avatar'),
                width: 96,
                height: 96,
                alignment: Alignment.center,
                decoration:
                    BoxDecoration(color: colors.bg, shape: BoxShape.circle),
                child: Text(
                  initial,
                  style: TextStyle(
                    fontSize: 42,
                    fontWeight: FontWeight.w700,
                    color: colors.fg,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Center(
              child: Container(
                height: 56,
                constraints: const BoxConstraints(minWidth: 160, maxWidth: 320),
                padding: const EdgeInsets.symmetric(horizontal: 18),
                decoration: BoxDecoration(
                  color: AppTokens.white,
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: AppTokens.green, width: 2),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Flexible(
                      child: IntrinsicWidth(
                        child: TextField(
                          key: const Key('profile_name'),
                          controller: _nameCtl,
                          focusNode: _nameFocus,
                          textInputAction: TextInputAction.done,
                          onSubmitted: (_) => _commitName(),
                          decoration: InputDecoration(
                            filled: false,
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            isDense: true,
                            contentPadding: EdgeInsets.zero,
                            hintText: l10n.profile_nameLabel,
                          ),
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            color: AppTokens.ink,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    const ExcludeSemantics(
                      child: Icon(
                        Icons.edit_outlined,
                        size: 22,
                        color: AppTokens.green,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      l10n.profile_edit,
                      style: const TextStyle(
                        fontSize: 14,
                        color: AppTokens.green,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (_phone.isNotEmpty) ...[
              const SizedBox(height: 8),
              Center(
                child: Text(
                  _phone,
                  style: const TextStyle(fontSize: 14, color: AppTokens.muted),
                ),
              ),
            ],
            const SizedBox(height: 14),
            _Card(
              children: [
                _Row(
                  title: l10n.profile_language,
                  trailing: _Choices(
                    keyPrefix: 'profile_lang',
                    options: const [('bn', 'বাংলা'), ('en', 'English')],
                    selected: prefs.locale.languageCode,
                    onSelect: (v) => _run(ctl.setLocale(Locale(v))),
                  ),
                ),
                _Row(
                  title: l10n.profile_numbers,
                  trailing: _Choices(
                    keyPrefix: 'profile_num',
                    options: const [('bangla', '১২৩'), ('latin', '123')],
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
                  tint: AppTokens.greenTint,
                  title: l10n.profile_simple,
                  titleColor: AppTokens.deepGreen,
                  titleWeight: FontWeight.w700,
                  body: l10n.profile_simpleBody,
                  bodyColor: AppTokens.deepGreen,
                  trailing: _Switch(
                    key: const Key('profile_simple_switch'),
                    label: l10n.profile_simple,
                    on: prefs.simpleMode,
                    onChanged: (v) => _run(ctl.setSimpleMode(v)),
                  ),
                ),
                _Row(
                  title: l10n.profile_remind,
                  body: l10n.profile_reminderAt(
                    reminderWords(l10n, prefs.reminderTime, prefs.numeralStyle),
                  ),
                  trailing: _Pill(
                    key: const Key('profile_change_time'),
                    label: l10n.profile_changeTime,
                    onTap: () => _pickTime(prefs),
                  ),
                  last: false,
                ),
                _Row(
                  title: l10n.profile_hide,
                  body: l10n.profile_hideBody,
                  trailing: _Switch(
                    key: const Key('profile_hide_switch'),
                    label: l10n.profile_hide,
                    on: prefs.hidePresence,
                    onChanged: (v) => _run(ctl.setHidePresence(v)),
                  ),
                  last: true,
                ),
              ],
            ),
            const SizedBox(height: 12),
            _Card(
              children: [
                _Row(
                  key: const Key('profile_privacy'),
                  title: l10n.profile_privacy,
                  trailing: const Icon(Icons.chevron_right, size: 28),
                  onTap: () => _go(Routes.consentPolicy),
                ),
                _Row(
                  key: const Key('profile_delete'),
                  title: l10n.profile_delete,
                  titleColor: AppTokens.danger,
                  titleWeight: FontWeight.w700,
                  trailing: const Icon(
                    Icons.chevron_right,
                    size: 28,
                    color: AppTokens.danger,
                  ),
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
            : const Border(bottom: BorderSide(color: Color(0xFFF1E6D3))),
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
                    fontSize: 18,
                    fontWeight: titleWeight,
                    color: titleColor,
                  ),
                ),
                if (body != null)
                  Text(
                    body!,
                    style: TextStyle(fontSize: 14, color: bodyColor),
                  ),
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

/// Two or more choice chips; the chosen one shows a tick and a green fill.
class _Choices extends StatelessWidget {
  const _Choices({
    required this.keyPrefix,
    required this.options,
    required this.selected,
    required this.onSelect,
  });

  final String keyPrefix;
  final List<(String, String)> options;
  final String selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final (id, label) in options) ...[
            Semantics(
              button: true,
              selected: id == selected,
              label: label,
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
                    color: id == selected
                        ? AppTokens.green
                        : const Color(0xFFF1E6D3),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (id == selected) ...[
                        const Icon(
                          Icons.check,
                          size: 18,
                          color: AppTokens.white,
                        ),
                        const SizedBox(width: 4),
                      ],
                      Text(
                        label,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: id == selected
                              ? FontWeight.w700
                              : FontWeight.w600,
                          color:
                              id == selected ? AppTokens.white : AppTokens.ink,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ],
      );
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
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: Container(
            constraints: const BoxConstraints(minHeight: 48),
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: AppTokens.green,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppTokens.white,
              ),
            ),
          ),
        ),
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
