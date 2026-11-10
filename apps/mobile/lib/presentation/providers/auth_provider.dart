import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/speech/voice_service.dart';
import '../../data/api/api_client.dart';
import '../../data/api/api_transport.dart';
import '../../data/auth/session_manager.dart';
import '../../data/auth/token_store.dart';
import '../../data/sync/pending_queue.dart';
import '../../data/sync/sync_service.dart';
import 'providers.dart';

const _legacyTokenKey = 'amar-poribar.token';

class AuthState {
  final bool loaded;
  final String? token;
  final FamilyInfo? family;
  final bool expired;
  const AuthState({
    this.loaded = false,
    this.token,
    this.family,
    this.expired = false,
  });

  bool get signedIn => token != null;
}

class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient api;
  final SessionManager session;
  StreamSubscription<SessionState>? _sub;

  AuthNotifier(this.api, this.session) : super(const AuthState()) {
    _sub = session.states.listen((s) {
      if (s == SessionState.expired && mounted) {
        // Local data stays; only the sign-in goes (FR-AUTH-09).
        state = const AuthState(loaded: true, expired: true);
      }
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  /// Restores a saved session. A rejected session signs the user out.
  Future<void> restore() async {
    if (await _dropLegacyToken()) {
      // Old tokens have no refresh token: ask for a fresh sign-in (F6).
      await session.markExpired();
      state = const AuthState(loaded: true, expired: true);
      return;
    }
    if (!await session.restore()) {
      state = const AuthState(loaded: true);
      return;
    }
    await _loadFamily();
  }

  /// Deletes the pre-T-MOB-07 plain-text token; true when one was there.
  Future<bool> _dropLegacyToken() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (!prefs.containsKey(_legacyTokenKey)) return false;
      await prefs.remove(_legacyTokenKey);
      return await session.store.read() == null;
    } catch (_) {
      return false;
    }
  }

  Future<void> signIn(String phone, String code) async {
    await api.verifyOtp(phone, code);
    await _loadFamily();
  }

  Future<void> _loadFamily() async {
    try {
      final fams = await api.families();
      final token = await session.validAccessToken();
      if (token == null) return; // expired while loading; listener handled it
      state = AuthState(
        loaded: true,
        token: token,
        family: fams.isEmpty ? null : fams.first,
      );
    } on ApiException catch (e) {
      if (e.isUnauthorized) {
        if (session.state != SessionState.expired) await signOut();
      } else {
        // Offline: keep the session; the family is loaded when the network returns.
        state = AuthState(
          loaded: true,
          token: await session.validAccessToken(),
        );
      }
    }
  }

  Future<void> createFamily(String name) async {
    final fam = await api.createFamily(name);
    state = AuthState(loaded: true, token: state.token, family: fam);
  }

  Future<void> signOut() async {
    await session.signOut();
    state = const AuthState(loaded: true);
  }
}

final tokenStoreProvider = Provider<TokenStore>((ref) => SecureTokenStore());

final httpClientProvider = Provider<http.Client>((ref) => http.Client());

final sessionManagerProvider = Provider<SessionManager>((ref) {
  final client = ref.watch(httpClientProvider);
  final sm = SessionManager(
    store: ref.watch(tokenStoreProvider),
    refresh: (r) => refreshTokens(client, kApiUrl, r),
  );
  ref.onDispose(sm.dispose);
  return sm;
});

/// For the router guard (T-MOB-08): current state first, then changes.
final sessionStateProvider = StreamProvider<SessionState>((ref) async* {
  final sm = ref.watch(sessionManagerProvider);
  yield sm.state;
  yield* sm.states;
});

final apiClientProvider = Provider<ApiClient>(
  (ref) => ApiClient(
    client: ref.watch(httpClientProvider),
    session: ref.watch(sessionManagerProvider),
  ),
);

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(
    ref.watch(apiClientProvider),
    ref.watch(sessionManagerProvider),
  );
});

final voiceServiceProvider =
    Provider<VoiceService>((ref) => DeviceVoiceService());

final syncServiceProvider = Provider<SyncService>((ref) {
  return SyncService(
    ref.watch(localStoreProvider),
    ref.watch(apiClientProvider),
  );
});

final pendingQueueProvider = Provider<PendingQueue>((ref) {
  return PendingQueue(
    ref.watch(localStoreProvider),
    ref.watch(apiClientProvider),
  );
});
