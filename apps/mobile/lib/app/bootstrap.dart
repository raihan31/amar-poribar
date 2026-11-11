import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/auth/token_store.dart';
import '../data/database/database.dart';
import '../data/database/local_store.dart';
import '../presentation/providers/auth_provider.dart';
import '../presentation/providers/providers.dart';
import 'redirects.dart';

/// Starts Firebase. Left null until the Firebase packages are added (push, T-NOTIF client tasks).
/// Debug builds without `google-services.json` must still run, so a failure here is swallowed.
typedef FirebaseInit = Future<void> Function();

/// Opens everything the app needs before the first frame and returns the provider overrides:
/// the Drift database wrapped in [LocalStore], the secure token store, and the saved
/// welcome / tutorial flags so the first route is right.
Future<List<Override>> bootstrap({
  LocalStore? store,
  TokenStore? tokens,
  FirebaseInit? firebase,
}) async {
  await _initFirebase(firebase);
  final opened = store ?? await LocalStore.open(await AppDatabase.open());
  final welcomeDone = await opened.getMeta('welcome_done') != null;
  final tutorialDone = await opened.getMeta('tutorial_done') != null;
  final consentCurrent = await opened.getMeta(consentVersionKey) != null;
  return [
    localStoreProvider.overrideWithValue(opened),
    tokenStoreProvider.overrideWithValue(tokens ?? SecureTokenStore()),
    welcomeDoneProvider.overrideWith((ref) => welcomeDone),
    tutorialDoneProvider.overrideWith((ref) => tutorialDone),
    consentCurrentProvider.overrideWith((ref) => consentCurrent),
  ];
}

Future<void> _initFirebase(FirebaseInit? init) async {
  if (init == null) return;
  try {
    await init();
  } catch (_) {
    // No Firebase config in this build: carry on without push.
  }
}
