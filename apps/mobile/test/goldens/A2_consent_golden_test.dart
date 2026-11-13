// ignore_for_file: file_names
import 'package:amar_poribar/features/onboarding/data/fake_onboarding_repository.dart';
import 'package:amar_poribar/features/onboarding/data/onboarding_repository.dart';
import 'package:amar_poribar/features/onboarding/ui/consent_screen.dart';

import 'golden_config.dart';

void main() {
  goldenScreen(
    'A2_consent',
    const ConsentScreen(),
    overrides: [
      onboardingRepositoryProvider.overrideWithValue(
        FakeOnboardingRepository(),
      ),
    ],
  );
}
