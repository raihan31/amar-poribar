import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/l10n/locale_controller.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/ui_scale.dart';
import 'data/database/database.dart';
import 'data/database/local_store.dart';
import 'l10n/gen/app_localizations.dart';
import 'presentation/navigation/app_router.dart';
import 'presentation/providers/providers.dart';

Future<void> main() async {
  // The engine must be ready before opening the database or using platform plugins.
  WidgetsFlutterBinding.ensureInitialized();
  final store = await LocalStore.open(await AppDatabase.open());

  runApp(
    ProviderScope(
      overrides: [localStoreProvider.overrideWithValue(store)],
      child: const AmarPoribarApp(),
    ),
  );
}

class AmarPoribarApp extends ConsumerWidget {
  const AmarPoribarApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      onGenerateTitle: (context) => AppLocalizations.of(context).common_appName,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: const [Locale('bn'), Locale('en')],
      locale: ref.watch(localeProvider),
      theme: lightTheme(UiScale.normal),
      darkTheme: darkTheme(UiScale.normal),
      themeMode: ThemeMode.system,
      initialRoute: AppRouter.onboardingRoute,
      onGenerateRoute: AppRouter.generateRoute,
      debugShowCheckedModeBanner: false,
    );
  }
}
