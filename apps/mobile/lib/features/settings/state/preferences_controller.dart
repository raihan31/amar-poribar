import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/l10n/locale_controller.dart';
import '../../../core/money/money_format.dart';
import '../../../core/money/numeral_style_provider.dart';
import '../../../core/theme/ui_scale.dart';
import '../../../data/api/api_providers.dart';
import '../../../domain/models/api/engage.dart' as api;
import '../../../presentation/providers/providers.dart';
import '../data/profile_repository.dart';

/// The person's own settings (FR-AUTH-04, FR-VOICE-09, FR-PRES-02, FR-NOT-02).
class Preferences {
  const Preferences({
    this.locale = const Locale('bn'),
    this.numeralStyle = NumeralStyle.bangla,
    this.simpleMode = false,
    this.reminderTime = '21:00',
    this.hidePresence = false,
    this.quietStart = '22:00',
    this.quietEnd = '06:00',
  });

  /// `bn` or `en`.
  final Locale locale;

  /// `bangla` or `latin`.
  final NumeralStyle numeralStyle;
  final bool simpleMode;

  /// `HH:mm`, Asia/Dhaka.
  final String reminderTime;
  final bool hidePresence;

  /// Quiet hours, `HH:mm` Asia/Dhaka (FR-NOTIF-05). Default 22:00 to 06:00.
  final String quietStart;
  final String quietEnd;

  Preferences copyWith({
    Locale? locale,
    NumeralStyle? numeralStyle,
    bool? simpleMode,
    String? reminderTime,
    bool? hidePresence,
    String? quietStart,
    String? quietEnd,
  }) =>
      Preferences(
        locale: locale ?? this.locale,
        numeralStyle: numeralStyle ?? this.numeralStyle,
        simpleMode: simpleMode ?? this.simpleMode,
        reminderTime: reminderTime ?? this.reminderTime,
        hidePresence: hidePresence ?? this.hidePresence,
        quietStart: quietStart ?? this.quietStart,
        quietEnd: quietEnd ?? this.quietEnd,
      );
}

/// `Meta` keys, one per preference.
class PrefKeys {
  PrefKeys._();
  static const locale = 'pref_locale';
  static const numerals = 'pref_numerals';
  static const simple = 'pref_simple';
  static const reminder = 'pref_reminder';
  static const hidePresence = 'pref_hide_presence';
  static const quietStart = 'pref_quiet_start';
  static const quietEnd = 'pref_quiet_end';
}

/// Sends changed fields to the server, or queues them (see `ProfileSync`). False when the server
/// rejected the change. Tests override it.
final preferencesPushProvider =
    Provider<Future<bool> Function(Map<String, dynamic> patch)>((ref) {
  return (patch) =>
      ref.read(profileSyncProvider).send(ProfilePatch.fromJson(patch));
});

/// Sends quiet hours to `PUT /v1/me/notification-preferences` (keeps the other fields the server
/// holds). False when it fails. Tests override it.
final quietHoursPushProvider =
    Provider<Future<bool> Function(String start, String end)>((ref) {
  return (start, end) async {
    try {
      final a = ref.read(notificationApiProvider);
      final cur = await a.preferences();
      await a.savePreferences(
        api.Preferences(
          kinds: cur.kinds,
          quietStart: start,
          quietEnd: end,
          dailyReminderTime: cur.dailyReminderTime,
          hidePresence: cur.hidePresence,
        ),
      );
      return true;
    } catch (_) {
      return false;
    }
  };
});

/// Holds the preferences, keeps the app-wide providers (language, numerals, sizing) in step,
/// stores each value in `Meta('pref_*')` and pushes it to the server when signed in.
class PreferencesController extends StateNotifier<Preferences> {
  PreferencesController(this._ref, {bool autoLoad = true})
      : super(
          autoLoad
              ? Preferences(
                  locale: _ref.read(localeProvider),
                  numeralStyle: _ref.read(numeralStyleProvider),
                  simpleMode: _ref.read(uiScaleProvider) == UiScale.simple,
                )
              : const Preferences(),
        ) {
    loaded = autoLoad ? _load() : Future.value();
  }

  final Ref _ref;

  /// With `autoLoad: false` nothing is read from the store (screens under test without one).
  /// Completes once the stored values have been read and applied.
  late final Future<void> loaded;

  Future<void> _load() async {
    final store = _ref.read(localStoreProvider);
    final loc = await store.getMeta(PrefKeys.locale);
    final num = await store.getMeta(PrefKeys.numerals);
    final simple = await store.getMeta(PrefKeys.simple);
    final reminder = await store.getMeta(PrefKeys.reminder);
    final hide = await store.getMeta(PrefKeys.hidePresence);
    final qs = await store.getMeta(PrefKeys.quietStart);
    final qe = await store.getMeta(PrefKeys.quietEnd);
    if (!mounted) return;
    final saved = Preferences(
      locale: loc == 'en' || loc == 'bn' ? Locale(loc!) : state.locale,
      numeralStyle: num == null
          ? state.numeralStyle
          : (num == 'latin' ? NumeralStyle.latin : NumeralStyle.bangla),
      simpleMode: simple == null ? state.simpleMode : simple == '1',
      reminderTime: reminder ?? state.reminderTime,
      hidePresence: hide == '1',
      quietStart: qs ?? state.quietStart,
      quietEnd: qe ?? state.quietEnd,
    );
    state = saved;
    _apply(saved);
  }

  void _apply(Preferences p) {
    _ref.read(numeralStyleProvider.notifier).state = p.numeralStyle;
    _ref.read(uiScaleProvider.notifier).state =
        p.simpleMode ? UiScale.simple : UiScale.normal;
  }

  /// Applies [next] everywhere, stores it, then sends [patch]. If the server rejects the change
  /// the previous values come back (optimistic update with rollback). Returns false on rollback.
  Future<bool> _commit(Preferences next, Map<String, dynamic> patch) async {
    final prev = state;
    await _set(next);
    final ok = await _ref.read(preferencesPushProvider)(patch);
    if (!ok && mounted) await _set(prev);
    return ok;
  }

  Future<void> _set(Preferences p) async {
    state = p;
    _apply(p);
    final store = _ref.read(localStoreProvider);
    await _ref.read(localeProvider.notifier).setLocale(p.locale);
    await store.setMeta(PrefKeys.locale, p.locale.languageCode);
    await store.setMeta(
      PrefKeys.numerals,
      p.numeralStyle == NumeralStyle.latin ? 'latin' : 'bangla',
    );
    await store.setMeta(PrefKeys.simple, p.simpleMode ? '1' : '0');
    await store.setMeta(PrefKeys.reminder, p.reminderTime);
    await store.setMeta(PrefKeys.hidePresence, p.hidePresence ? '1' : '0');
    await store.setMeta(PrefKeys.quietStart, p.quietStart);
    await store.setMeta(PrefKeys.quietEnd, p.quietEnd);
  }

  Future<bool> setLocale(Locale locale) async {
    if (locale.languageCode != 'bn' && locale.languageCode != 'en') {
      return true;
    }
    final l = Locale(locale.languageCode);
    return _commit(state.copyWith(locale: l), {'locale': l.languageCode});
  }

  Future<bool> setNumeralStyle(NumeralStyle style) => _commit(
        state.copyWith(numeralStyle: style),
        {'bnDigits': style == NumeralStyle.bangla},
      );

  Future<bool> setSimpleMode(bool on) =>
      _commit(state.copyWith(simpleMode: on), {'simpleMode': on});

  Future<bool> setReminderTime(String hhmm) =>
      _commit(state.copyWith(reminderTime: hhmm), {'reminderTime': hhmm});

  /// Saves quiet hours locally, then pushes them; rolls back when the push fails.
  Future<bool> setQuietHours(String start, String end) async {
    final prev = state;
    await _set(state.copyWith(quietStart: start, quietEnd: end));
    final ok = await _ref.read(quietHoursPushProvider)(start, end);
    if (!ok && mounted) await _set(prev);
    return ok;
  }

  Future<bool> setHidePresence(bool hide) =>
      _commit(state.copyWith(hidePresence: hide), {'hidePresence': hide});
}

final preferencesProvider =
    StateNotifierProvider<PreferencesController, Preferences>(
  (ref) => PreferencesController(ref),
);
