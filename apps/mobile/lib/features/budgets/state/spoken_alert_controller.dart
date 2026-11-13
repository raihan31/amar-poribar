import 'dart:async';
import 'dart:convert';

import 'package:flutter/widgets.dart';

import '../../../core/speech/budget_alerts.dart';
import '../../../core/speech/voice_service.dart';

/// Speaks budget alerts (FR-BUD-02, FR-VOICE-10). It looks at the budgets whenever the local copy
/// changes (after a sync) and when the app comes to the foreground, and speaks an alert when a budget
/// reaches 80% or 100% and not again until it gets worse. What was spoken is remembered per month in
/// `Meta('alerts_spoken:<month>')`.
class SpokenAlertController with WidgetsBindingObserver {
  SpokenAlertController({
    required this.watch,
    required this.voice,
    required this.getMeta,
    required this.setMeta,
    required this.month,
  });

  final Stream<List<BudgetStatus>> Function(String month) watch;
  final VoiceService voice;
  final Future<String?> Function(String key) getMeta;
  final Future<void> Function(String key, String value) setMeta;
  final String Function() month;

  StreamSubscription<List<BudgetStatus>>? _sub;
  List<BudgetStatus> _latest = const [];
  Future<void> _chain = Future<void>.value();
  bool _observing = false;

  static String metaKey(String month) => 'alerts_spoken:$month';

  /// Starts watching. Call [stop] when done.
  void start() {
    if (_sub != null) return;
    _sub = watch(month()).listen((list) {
      _latest = list;
      _enqueue(() => _speakNew(list));
    });
    try {
      WidgetsBinding.instance.addObserver(this);
      _observing = true;
    } catch (_) {
      // No binding (plain Dart test): foreground checks are off.
    }
  }

  void stop() {
    _sub?.cancel();
    _sub = null;
    if (_observing) {
      WidgetsBinding.instance.removeObserver(this);
      _observing = false;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(check());
  }

  void _enqueue(Future<void> Function() job) {
    _chain = _chain.then((_) => job()).catchError((_) {});
  }

  /// Looks at the latest budgets now and speaks what is new.
  Future<void> check() {
    _enqueue(() async {
      if (_sub == null) _latest = await watch(month()).first;
      await _speakNew(_latest);
    });
    return _chain;
  }

  Future<Map<String, String>> _lastSpoken(String m) async {
    final raw = await getMeta(metaKey(m));
    if (raw == null) return {};
    try {
      return (jsonDecode(raw) as Map).cast<String, String>();
    } catch (_) {
      return {};
    }
  }

  Future<void> _speakNew(List<BudgetStatus> budgets) async {
    final m = month();
    final last = await _lastSpoken(m);
    final alerts = alertsToSpeak(budgets, last);
    if (alerts.isEmpty) return;
    for (final a in alerts) {
      last[a.key] = a.level;
    }
    // Remember first: a crash while speaking must not make the same alert repeat.
    await setMeta(metaKey(m), jsonEncode(last));
    for (final a in alerts) {
      await voice.speak(a.text);
    }
  }

  /// The speaker button: speaks every budget that is not ok, spoken before or not. Returns how many.
  Future<int> speakAll() async {
    final alerts = alertsToSpeak(
      _latest.isEmpty ? await _first() : _latest,
      {},
    );
    for (final a in alerts) {
      await voice.speak(a.text);
    }
    return alerts.length;
  }

  Future<List<BudgetStatus>> _first() async {
    _latest = await watch(month()).first;
    return _latest;
  }
}
