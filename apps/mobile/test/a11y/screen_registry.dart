import 'package:amar_poribar/app/redirects.dart';
import 'package:amar_poribar/features/auth/data/auth_repository.dart';
import 'package:amar_poribar/features/auth/data/fake_auth_repository.dart';
import 'package:amar_poribar/features/auth/ui/login_screen.dart';
import 'package:amar_poribar/features/auth/ui/session_expired_screen.dart';
import 'package:amar_poribar/features/family/data/invite_repository.dart';
import 'package:amar_poribar/features/family/state/family_providers.dart';
import 'package:amar_poribar/features/family/ui/join_screen.dart';
import 'package:amar_poribar/features/onboarding/ui/welcome_screen.dart';
import 'package:amar_poribar/features/settings/state/preferences_controller.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../helpers/fake_auth.dart';

typedef ScreenFactory = Widget Function(BuildContext context);

/// One screen's entry in the accessibility audit.
class ScreenEntry {
  const ScreenEntry(this.code, this.route, this.factory, this.needs);

  /// Design board code from SRS 5.1.3, for example `B1`.
  final String code;
  final String route;
  final ScreenFactory factory;
  final List<Override> needs;
}

final List<ScreenEntry> _screens = [];

/// Registers a screen for `screens_a11y_test.dart`. Every screen task appends
/// one call in [registerAllScreens]:
///
/// `registerScreen('B1', Routes.list, (c) => TransactionsScreen(), needs: [...]);`
void registerScreen(
  String code,
  String route,
  ScreenFactory factory, {
  List<Override> needs = const [],
}) {
  _screens.add(ScreenEntry(code, route, factory, needs));
}

/// Registered screens, in registration order.
List<ScreenEntry> get registeredScreens {
  registerAllScreens();
  return List.unmodifiable(_screens);
}

bool _registered = false;

/// Screen tasks add their line here.
void registerAllScreens() {
  if (_registered) return;
  _registered = true;
  // registerScreen('B1', Routes.list, (c) => TransactionsScreen(), needs: [...]);
  registerScreen(
    'A1',
    Routes.login,
    (c) => const LoginScreen(),
    needs: [authRepositoryProvider.overrideWithValue(FakeAuthRepository())],
  );
  registerScreen(
    'F6',
    Routes.sessionExpired,
    (c) => const SessionExpiredScreen(),
  );
  registerScreen(
    'A6',
    Routes.join,
    (c) => const JoinScreen(token: 'abc'),
    needs: [
      authProvider.overrideWith(
        (ref) => FakeAuthNotifier(const AuthState(loaded: true, token: 't')),
      ),
      inviteRepositoryProvider.overrideWithValue(FakeInviteRepository()),
      inviteClockProvider.overrideWithValue(() => DateTime.utc(2026, 11, 9, 4)),
    ],
  );
  registerScreen(
    'D1',
    Routes.welcome,
    (c) => const WelcomeScreen(),
    needs: [
      preferencesProvider.overrideWith(
        (ref) => PreferencesController(ref, autoLoad: false),
      ),
    ],
  );
}

/// Routes that exist in the app. Until the `Routes` table of T-MOB-13 lands
/// this mirrors [Routes]; a new route added there must be added here too.
const List<String> kAllRoutes = [
  Routes.welcome,
  Routes.home,
  Routes.transactions,
  Routes.pendingSms,
  Routes.settings,
  Routes.login,
  Routes.sessionExpired,
  Routes.join,
  Routes.add,
  Routes.tutorial,
];

/// Pre-existing screens not yet in the audit. Each screen task removes its
/// route from this list when it registers the screen. The list may only
/// shrink: `registry_complete_test.dart` fails if a route is in neither place.
const Set<String> kRoutesAwaitingRegistration = {
  Routes.home,
  Routes.transactions,
  Routes.pendingSms,
  Routes.settings,
  Routes.add,
  Routes.tutorial,
};
