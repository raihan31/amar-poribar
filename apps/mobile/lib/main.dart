import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'app/redirects.dart';
import 'data/database/database.dart';
import 'data/database/local_store.dart';
import 'presentation/providers/auth_provider.dart';
import 'presentation/providers/providers.dart';

Future<void> main() async {
  // The engine must be ready before opening the database or using platform plugins.
  WidgetsFlutterBinding.ensureInitialized();
  final store = await LocalStore.open(await AppDatabase.open());

  // The first route comes from the redirect, so the session and flags load before the first frame.
  final container = ProviderContainer(
    overrides: [localStoreProvider.overrideWithValue(store)],
  );
  container.read(welcomeDoneProvider.notifier).state =
      await store.getMeta('welcome_done') != null;
  container.read(tutorialDoneProvider.notifier).state =
      await store.getMeta('tutorial_done') != null;
  await container.read(authProvider.notifier).restore();

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const AmarPoribarApp(),
    ),
  );
}
