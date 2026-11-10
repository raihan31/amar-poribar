import 'dart:async';

import '../api/api_exception.dart';
import 'token_store.dart';

enum SessionState { signedOut, signedIn, expired }

typedef RefreshFn = Future<Tokens> Function(String refreshToken);

/// Holds the tokens and refreshes the access token shortly before it expires.
class SessionManager {
  static const refreshMargin = Duration(seconds: 60);

  final TokenStore store;
  final RefreshFn refresh;
  final DateTime Function() now;
  final void Function()? onSessionExpired;

  Tokens? _tokens;
  bool _loaded = false;
  Completer<String?>? _inFlight;
  SessionState _state = SessionState.signedOut;
  final _controller = StreamController<SessionState>.broadcast();

  SessionManager({
    required this.store,
    required this.refresh,
    DateTime Function()? now,
    this.onSessionExpired,
  }) : now = now ?? DateTime.now;

  SessionState get state => _state;
  Stream<SessionState> get states => _controller.stream;

  void _emit(SessionState s) {
    _state = s;
    if (!_controller.isClosed) _controller.add(s);
  }

  Future<void> _load() async {
    if (_loaded) return;
    _loaded = true;
    _tokens = await store.read();
  }

  /// Reads saved tokens; returns true when a session exists.
  Future<bool> restore() async {
    await _load();
    if (_tokens != null) _emit(SessionState.signedIn);
    return _tokens != null;
  }

  Future<void> setTokens(Tokens t) async {
    _loaded = true;
    _tokens = t;
    await store.write(t);
    _emit(SessionState.signedIn);
  }

  /// Signs out on purpose (logout); not an expiry.
  Future<void> signOut() async {
    _loaded = true;
    _tokens = null;
    await store.clear();
    _emit(SessionState.signedOut);
  }

  /// Marks the session expired (F6) without any tokens to refresh.
  Future<void> markExpired() async {
    _loaded = true;
    _tokens = null;
    await store.clear();
    _emit(SessionState.expired);
  }

  /// A token good for at least 60 more seconds, or null when signed out.
  Future<String?> validAccessToken() async {
    await _load();
    final t = _tokens;
    if (t == null) return null;
    if (t.accessExpiresAt.difference(now()) > refreshMargin) return t.access;
    return _refreshShared(t.access);
  }

  /// Refreshes now because [rejected] got a 401. Skips the call when
  /// another request already replaced that token.
  Future<String?> refreshAfterRejection(String rejected) async {
    await _load();
    final t = _tokens;
    if (t == null) return null;
    if (t.access != rejected) return t.access;
    return _refreshShared(rejected);
  }

  Future<String?> _refreshShared(String current) {
    final running = _inFlight;
    if (running != null) return running.future;
    final c = Completer<String?>();
    _inFlight = c;
    _doRefresh(current).then(c.complete, onError: c.completeError).whenComplete(
          () => _inFlight = null,
        );
    return c.future;
  }

  Future<String?> _doRefresh(String current) async {
    final t = _tokens;
    if (t == null) return null;
    try {
      final next = await refresh(t.refresh);
      _tokens = next;
      await store.write(next);
      _emit(SessionState.signedIn);
      return next.access;
    } on ApiException catch (e) {
      if (e.status == 401 || e.code == 'session_revoked') {
        _tokens = null;
        await store.clear();
        _emit(SessionState.expired);
        onSessionExpired?.call();
        return null;
      }
      return current; // offline or server trouble: keep the session
    }
  }

  void dispose() => _controller.close();
}
