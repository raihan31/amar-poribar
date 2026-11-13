import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'app/bootstrap.dart';
import 'app/push_wiring.dart';
import 'core/push/push_service.dart';
import 'features/onboarding/state/consent_check.dart';
import 'presentation/providers/auth_provider.dart';

/// FCM background and terminated-state messages (T-MOB-34). The vibration and inbox work
/// lands in T-MOB-42; until then the system notification is all that is shown.
@pragma('vm:entry-point')
Future<void> backgroundHandler(RemoteMessage message) async {
  try {
    if (Firebase.apps.isEmpty) await Firebase.initializeApp();
  } catch (_) {}
}

/// Starts Firebase once. Throws when the build has no `google-services.json`.
Future<void> initFirebase() async {
  if (Firebase.apps.isEmpty) await Firebase.initializeApp();
}

Future<void> main() async {
  // The engine must be ready before opening the database or using platform plugins.
  WidgetsFlutterBinding.ensureInitialized();
  final overrides = await bootstrap(firebase: initFirebase);
  final fcmReady = Firebase.apps.isNotEmpty;
  if (fcmReady) FirebaseMessaging.onBackgroundMessage(backgroundHandler);

  // The first route comes from the redirect, so the session loads before the first frame.
  final container = ProviderContainer(
    overrides: [
      ...overrides,
      // No Firebase config: the fake service has no token, so push stays off.
      if (fcmReady) pushServiceProvider.overrideWithValue(FcmPushService()),
    ],
  );
  await container.read(authProvider.notifier).restore();
  if (container.read(authProvider).signedIn) await checkConsent(container);

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const AmarPoribarApp(),
    ),
  );
}
