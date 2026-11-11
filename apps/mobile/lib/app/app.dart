import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/l10n/locale_controller.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/ui_scale.dart';
import '../features/settings/state/preferences_controller.dart';
import '../features/voice/state/voice_capability_provider.dart';
import '../l10n/gen/app_localizations.dart';
import 'push_wiring.dart';
import 'router.dart';

class AmarPoribarApp extends ConsumerWidget {
  const AmarPoribarApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Probe speech support once at start (FR-VOICE-07).
    ref.watch(voiceCapabilityProvider);
    final scale = ref.watch(uiScaleProvider);
    ref.watch(preferencesProvider); // loads the saved preferences
    ref.watch(pushWiringProvider); // channels, device registration, tap routing
    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context).common_appName,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: const [Locale('bn'), Locale('en')],
      locale: ref.watch(localeProvider),
      theme: lightTheme(scale),
      darkTheme: darkTheme(scale),
      themeMode: ThemeMode.system,
      routerConfig: ref.watch(routerProvider),
      debugShowCheckedModeBanner: false,
    );
  }
}
