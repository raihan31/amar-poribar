import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/l10n/locale_controller.dart';
import '../../../core/money/money_format.dart';
import '../../../core/money/numeral_style_provider.dart';
import '../../../core/theme/ui_scale.dart';
import '../../../data/api/api_providers.dart';
import '../../../presentation/providers/auth_provider.dart';
import '../../../presentation/providers/providers.dart';

/// The person's own settings (FR-AUTH-04, FR-VOICE-09, FR-PRES-02, FR-NOT-02).
class Preferences {
  const Preferences({
    this.locale = const Locale('bn'),
    this.numeralStyle = NumeralStyle.bangla,
    this.simpleMode = false,
    this.reminderTime = '21:00',
    this.hidePresence = false,
  });

  /// `bn` or `en`.
  final Locale locale;

  /// `bangla` or `latin`.
  final NumeralStyle numeralStyle;
  final bool simpleMode;

  /// `HH:mm`, Asia/Dhaka.
  final String reminderTime;
  final bool hidePresence;

  Preferences copyWith({
    Locale? locale,
    NumeralStyle? numeralStyle,
    bool? simpleMode,
    String? reminderTime,
    bool? hidePresence,
  }) =>
      Preferences(
        locale: locale ?? this.locale,
        numeralStyle: numeralStyle ?? this.numeralStyle,
        simpleMode: simpleMode ?? this.simpleMode,
        reminderTime: reminderTime ?? this.reminderTime,
        hidePresence: hidePresence ?? this.hidePresence,
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
}

/// Pushes changed fields to the server when signed in. Tests override it.
final preferencesPushProvider =
    Provider<Future<void> Function(Map<String, dynamic> patch)>((ref) {
  return (patch) async {
    if (!ref.read(authProvider).signedIn) return;
    try {
      await ref.read(authApiProvider).updateProfile(patch);
    } catch (_) {
      // Stays local; the profile screen's queue (T-MOB-20) retries later.
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
    if (!mounted) return;
    final saved = Preferences(
      locale: loc == 'en' || loc == 'bn' ? Locale(loc!) : state.locale,
      numeralStyle: num == null
          ? state.numeralStyle
          : (num == 'latin' ? NumeralStyle.latin : NumeralStyle.bangla),
      simpleMode: simple == null ? state.simpleMode : simple == '1',
      reminderTime: reminder ?? state.reminderTime,
      hidePresence: hide == '1',
    );
    state = saved;
    _apply(saved);
  }

  void _apply(Preferences p) {
    _ref.read(numeralStyleProvider.notifier).state = p.numeralStyle;
    _ref.read(uiScaleProvider.notifier).state =
        p.simpleMode ? UiScale.simple : UiScale.normal;
  }

  Future<void> _push(Map<String, dynamic> patch) =>
      _ref.read(preferencesPushProvider)(patch);

  Future<void> setLocale(Locale locale) async {
    if (locale.languageCode != 'bn' && locale.languageCode != 'en') return;
    final l = Locale(locale.languageCode);
    state = state.copyWith(locale: l);
    await _ref.read(localeProvider.notifier).setLocale(l);
    await _ref
        .read(localStoreProvider)
        .setMeta(PrefKeys.locale, l.languageCode);
    await _push({'locale': l.languageCode});
  }

  Future<void> setNumeralStyle(NumeralStyle style) async {
    state = state.copyWith(numeralStyle: style);
    _ref.read(numeralStyleProvider.notifier).state = style;
    await _ref.read(localStoreProvider).setMeta(
          PrefKeys.numerals,
          style == NumeralStyle.latin ? 'latin' : 'bangla',
        );
    await _push({'bnDigits': style == NumeralStyle.bangla});
  }

  Future<void> setSimpleMode(bool on) async {
    state = state.copyWith(simpleMode: on);
    _ref.read(uiScaleProvider.notifier).state =
        on ? UiScale.simple : UiScale.normal;
    await _ref
        .read(localStoreProvider)
        .setMeta(PrefKeys.simple, on ? '1' : '0');
    await _push({'simpleMode': on});
  }

  Future<void> setReminderTime(String hhmm) async {
    state = state.copyWith(reminderTime: hhmm);
    await _ref.read(localStoreProvider).setMeta(PrefKeys.reminder, hhmm);
    await _push({'reminderTime': hhmm});
  }

  Future<void> setHidePresence(bool hide) async {
    state = state.copyWith(hidePresence: hide);
    await _ref
        .read(localStoreProvider)
        .setMeta(PrefKeys.hidePresence, hide ? '1' : '0');
    await _push({'hidePresence': hide});
  }
}

final preferencesProvider =
    StateNotifierProvider<PreferencesController, Preferences>(
  (ref) => PreferencesController(ref),
);
