// ignore_for_file: file_names
import 'package:amar_poribar/core/theme/ui_scale.dart';
import 'package:amar_poribar/features/onboarding/ui/welcome_screen.dart';

import 'golden_config.dart';

void main() {
  goldenScreen('D1_welcome', const WelcomeScreen(), acTag: 'AC-26');
  goldenScreen(
    'D1_welcome_simple',
    const WelcomeScreen(),
    scale: UiScale.simple,
    overrides: [uiScaleProvider.overrideWith((ref) => UiScale.simple)],
  );
}
