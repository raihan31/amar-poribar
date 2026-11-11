import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/api/api_exception.dart';
import '../../../data/api/api_providers.dart';
import '../../../domain/models/api/me.dart';
import '../../../presentation/providers/auth_provider.dart';
import '../../../presentation/providers/providers.dart';

/// The fields of `PATCH /v1/me`. Only fields that are set are sent.
class ProfilePatch {
  const ProfilePatch({
    this.name,
    this.locale,
    this.bnDigits,
    this.simpleMode,
    this.reminderTime,
    this.hidePresence,
  });

  final String? name;
  final String? locale;
  final bool? bnDigits;
  final bool? simpleMode;

  /// `HH:mm`, Asia/Dhaka.
  final String? reminderTime;
  final bool? hidePresence;

  bool get isEmpty => toJson().isEmpty;

  Map<String, dynamic> toJson() => {
        if (name != null) 'name': name,
        if (locale != null) 'locale': locale,
        if (bnDigits != null) 'bnDigits': bnDigits,
        if (simpleMode != null) 'simpleMode': simpleMode,
        if (reminderTime != null) 'reminderTime': reminderTime,
        if (hidePresence != null) 'hidePresence': hidePresence,
      };

  factory ProfilePatch.fromJson(Map<String, dynamic> j) => ProfilePatch(
        name: j['name'] as String?,
        locale: j['locale'] as String?,
        bnDigits: j['bnDigits'] as bool?,
        simpleMode: j['simpleMode'] as bool?,
        reminderTime: j['reminderTime'] as String?,
        hidePresence: j['hidePresence'] as bool?,
      );

  /// This patch with [later] applied on top (later values win).
  ProfilePatch merge(ProfilePatch later) =>
      ProfilePatch.fromJson({...toJson(), ...later.toJson()});
}

/// Reads and changes the signed-in person's profile.
abstract class ProfileRepository {
  Future<Me> load();
  Future<Me> update(ProfilePatch patch);
}

class ApiProfileRepository implements ProfileRepository {
  ApiProfileRepository(this._ref);

  final Ref _ref;

  @override
  Future<Me> load() => _ref.read(familyApiProvider).me();

  @override
  Future<Me> update(ProfilePatch patch) async {
    await _ref.read(authApiProvider).updateProfile(patch.toJson());
    return load();
  }
}

/// The real repository; tests override it with `FakeProfileRepository`.
final profileRepositoryProvider = Provider<ProfileRepository>(
  (ref) => ApiProfileRepository(ref),
);

const profilePatchMetaKey = 'profile_patch';

/// Sends profile changes. A change that cannot reach the server (offline, server error, signed
/// out) is queued in `Meta('profile_patch')` and sent by [flush] later (T-MOB-48 calls it).
/// A change the server rejects (4xx) is not queued: [send] returns false so the caller rolls back.
class ProfileSync {
  ProfileSync(this._ref);

  final Ref _ref;

  Future<ProfilePatch> pending() async {
    final raw =
        await _ref.read(localStoreProvider).getMeta(profilePatchMetaKey);
    if (raw == null || raw.isEmpty) return const ProfilePatch();
    return ProfilePatch.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  Future<void> _store(ProfilePatch p) => _ref.read(localStoreProvider).setMeta(
        profilePatchMetaKey,
        p.isEmpty ? '' : jsonEncode(p.toJson()),
      );

  bool _rejected(Object e) =>
      e is ApiException && e.status >= 400 && e.status < 500 && e.status != 401;

  /// Sends [patch] together with anything still queued. False when the server rejected it.
  Future<bool> send(ProfilePatch patch) async {
    final all = (await pending()).merge(patch);
    if (!_ref.read(authProvider).signedIn) {
      await _store(all);
      return true;
    }
    try {
      await _ref.read(profileRepositoryProvider).update(all);
      await _store(const ProfilePatch());
      return true;
    } catch (e) {
      if (_rejected(e)) return false;
      await _store(all);
      return true;
    }
  }

  /// Sends the queue, if any. True when nothing is left waiting.
  Future<bool> flush() async {
    final queued = await pending();
    if (queued.isEmpty) return true;
    if (!_ref.read(authProvider).signedIn) return false;
    try {
      await _ref.read(profileRepositoryProvider).update(queued);
      await _store(const ProfilePatch());
      return true;
    } catch (e) {
      if (_rejected(e)) {
        await _store(const ProfilePatch()); // will never be accepted; drop it
        return true;
      }
      return false;
    }
  }
}

final profileSyncProvider = Provider<ProfileSync>((ref) => ProfileSync(ref));
