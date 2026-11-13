import 'package:amar_poribar/app/redirects.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
  Routes.add,
  Routes.tutorial,
];

/// Pre-existing screens not yet in the audit. Each screen task removes its
/// route from this list when it registers the screen. The list may only
/// shrink: `registry_complete_test.dart` fails if a route is in neither place.
const Set<String> kRoutesAwaitingRegistration = {
  Routes.welcome,
  Routes.home,
  Routes.transactions,
  Routes.pendingSms,
  Routes.settings,
  Routes.login,
  Routes.add,
  Routes.tutorial,
};
