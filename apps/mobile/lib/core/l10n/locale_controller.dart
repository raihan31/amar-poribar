import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/database/local_store.dart';
import '../../presentation/providers/providers.dart';

const _metaKey = 'locale';
const _supported = {'bn', 'en'};

/// The app language: Bangla by default, English on request, remembered in `Meta('locale')`.
class LocaleController extends StateNotifier<Locale> {
  final LocalStore _store;

  /// Completes once the saved choice has been read.
  late final Future<void> loaded;

  LocaleController(this._store) : super(const Locale('bn')) {
    loaded = _load();
  }

  Future<void> _load() async {
    final saved = await _store.getMeta(_metaKey);
    if (saved != null && _supported.contains(saved) && mounted) {
      state = Locale(saved);
    }
  }

  Future<void> setLocale(Locale locale) async {
    if (!_supported.contains(locale.languageCode)) return;
    state = Locale(locale.languageCode);
    await _store.setMeta(_metaKey, locale.languageCode);
  }
}

final localeProvider = StateNotifierProvider<LocaleController, Locale>(
  (ref) => LocaleController(ref.watch(localStoreProvider)),
);
