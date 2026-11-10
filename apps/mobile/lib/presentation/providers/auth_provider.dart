import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/speech/voice_service.dart';
import '../../data/api/api_client.dart';
import '../../data/sync/pending_queue.dart';
import '../../data/sync/sync_service.dart';
import 'providers.dart';

const _tokenKey = 'amar-poribar.token';

class AuthState {
  final bool loaded;
  final String? token;
  final FamilyInfo? family;
  const AuthState({this.loaded = false, this.token, this.family});

  bool get signedIn => token != null;
}

class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient api;
  AuthNotifier(this.api) : super(const AuthState());

  /// Restores a saved session. A rejected token (expired) signs the user out.
  Future<void> restore() async {
    String? saved;
    try {
      saved = (await SharedPreferences.getInstance()).getString(_tokenKey);
    } catch (_) {
      saved = null; // storage unavailable: start signed out
    }
    if (saved == null) {
      state = const AuthState(loaded: true);
      return;
    }
    api.token = saved;
    await _loadFamily(saved);
  }

  Future<void> signIn(String phone, String code) async {
    final token = await api.verifyOtp(phone, code);
    try {
      await (await SharedPreferences.getInstance()).setString(_tokenKey, token);
    } catch (_) {/* session just won't survive a restart */}
    await _loadFamily(token);
  }

  Future<void> _loadFamily(String token) async {
    try {
      final fams = await api.families();
      state = AuthState(
        loaded: true,
        token: token,
        family: fams.isEmpty ? null : fams.first,
      );
    } on ApiException catch (e) {
      if (e.isUnauthorized) {
        await signOut();
      } else {
        // Offline: keep the session; the family is loaded when the network returns.
        state = AuthState(loaded: true, token: token);
      }
    }
  }

  Future<void> createFamily(String name) async {
    final fam = await api.createFamily(name);
    state = AuthState(loaded: true, token: state.token, family: fam);
  }

  Future<void> signOut() async {
    api.token = null;
    try {
      await (await SharedPreferences.getInstance()).remove(_tokenKey);
    } catch (_) {}
    state = const AuthState(loaded: true);
  }
}

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.watch(apiClientProvider));
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
