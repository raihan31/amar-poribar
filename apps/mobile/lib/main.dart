import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'app/bootstrap.dart';
import 'presentation/providers/auth_provider.dart';

Future<void> main() async {
  // The engine must be ready before opening the database or using platform plugins.
  WidgetsFlutterBinding.ensureInitialized();
  final overrides = await bootstrap();

  // The first route comes from the redirect, so the session loads before the first frame.
  final container = ProviderContainer(overrides: overrides);
  await container.read(authProvider.notifier).restore();

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const AmarPoribarApp(),
    ),
  );
}
