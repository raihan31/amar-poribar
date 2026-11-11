import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/database/local_store.dart';
import '../../../presentation/providers/auth_provider.dart';
import '../../../presentation/providers/providers.dart';
import '../../family/state/family_providers.dart';

/// `Meta` key holding the user id that owns the rows in the local database (T-MOB-16).
const dbOwnerKey = 'db_owner';

/// Tracks whose data is on this phone, so a session that expired (F6) can sign in again
/// without losing local data, while a different person never sees someone else's rows.
class SessionOwner {
  SessionOwner({
    required LocalStore Function() store,
    required this.userId,
    required this.signOut,
  }) : _store = store;

  /// Looked up on use, so a screen that never signs in does not need a database.
  final LocalStore Function() _store;
  LocalStore get store => _store();

  /// The id of the user who just signed in (`GET /v1/me`).
  final Future<String> Function() userId;

  /// Drops the tokens that were just stored.
  final Future<void> Function() signOut;

  /// True when the local database belongs to a different user than the one signing in.
  /// A database with no owner yet (fresh install, older app) belongs to whoever signs in.
  Future<bool> isOtherUser() async {
    final owner = await store.getMeta(dbOwnerKey);
    if (owner == null) return false;
    try {
      return owner != await userId();
    } catch (_) {
      return false; // cannot tell (offline): keep the data
    }
  }

  /// Tags the local database with the signed-in user. With [wipe] the old rows go first.
  Future<void> claim({bool wipe = false}) async {
    if (wipe) await store.wipeLocalData();
    try {
      await store.setMeta(dbOwnerKey, await userId());
    } catch (_) {
      // Offline: tagged on the next sign-in.
    }
  }

  /// "না" on the other-number question: forget the tokens, keep every row.
  Future<void> decline() => signOut();
}

final sessionOwnerProvider = Provider<SessionOwner>((ref) {
  return SessionOwner(
    store: () => ref.read(localStoreProvider),
    userId: () async {
      ref.invalidate(meProvider);
      ref.invalidate(myUserIdProvider);
      return ref.read(myUserIdProvider.future);
    },
    signOut: () => ref.read(authProvider.notifier).signOut(),
  );
});
