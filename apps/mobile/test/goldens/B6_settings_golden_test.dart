// ignore_for_file: file_names
import 'package:amar_poribar/features/settings/state/preferences_controller.dart';
import 'package:amar_poribar/features/settings/ui/settings_screen.dart';

import 'golden_config.dart';

/// Board: Settings.dc.html.
void main() {
  goldenScreen(
    'B6_settings',
    const SettingsScreen(),
    overrides: [
      preferencesProvider.overrideWith(
        (ref) => PreferencesController(ref, autoLoad: false),
      ),
    ],
  );
}
