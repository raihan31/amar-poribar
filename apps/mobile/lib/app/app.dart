import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/l10n/locale_controller.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/ui_scale.dart';
import '../l10n/gen/app_localizations.dart';
import 'router.dart';

class AmarPoribarApp extends ConsumerWidget {
  const AmarPoribarApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context).common_appName,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: const [Locale('bn'), Locale('en')],
      locale: ref.watch(localeProvider),
      theme: lightTheme(UiScale.normal),
      darkTheme: darkTheme(UiScale.normal),
      themeMode: ThemeMode.system,
      routerConfig: ref.watch(routerProvider),
      debugShowCheckedModeBanner: false,
    );
  }
}
