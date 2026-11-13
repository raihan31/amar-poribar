/// Design board name (see `docs/design/strings.json`) to the widget file that implements it,
/// relative to `apps/mobile`. Each screen task adds its line once its strings are in
/// `lib/l10n/app_bn.arb`. When all 43 non-admin screens are listed the design string test turns
/// strict.
const Map<String, String> implementedScreens = {
  'Consent': 'lib/features/onboarding/ui/consent_screen.dart',
  'Join': 'lib/features/family/ui/join_screen.dart',
  'Login': 'lib/features/auth/ui/login_screen.dart',
  'OtpError': 'lib/features/auth/ui/otp_error_panel.dart',
  'Profile': 'lib/features/settings/ui/profile_screen.dart',
  'SessionExpired': 'lib/features/auth/ui/session_expired_screen.dart',
  'Settings': 'lib/features/settings/ui/settings_screen.dart',
};
