import 'package:flutter/material.dart';

import '../screens/onboarding_screen.dart';
import '../screens/dashboard_screen.dart';
import '../screens/transaction_screen.dart';
import '../screens/settings_screen.dart'; // contains PendingSmsScreen too

class AppRouter {
  static const String onboardingRoute = '/';
  static const String dashboardRoute = '/dashboard';
  static const String transactionsRoute = '/transactions';
  static const String pendingSmsRoute = '/pending-sms';
  static const String settingsRoute = '/settings';

  static Route<dynamic> generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case onboardingRoute:
        return MaterialPageRoute(builder: (_) => OnboardingScreen());
      case dashboardRoute:
        return MaterialPageRoute(builder: (_) => DashboardScreen());
      case transactionsRoute:
        return MaterialPageRoute(builder: (_) => const TransactionScreen());
      case pendingSmsRoute:
        return MaterialPageRoute(builder: (_) => PendingSmsScreen());
      case settingsRoute:
        return MaterialPageRoute(builder: (_) => SettingsScreen());
      default:
        return MaterialPageRoute(
          builder: (_) => Scaffold(
            body: Center(child: Text('No route defined for ${settings.name}')),
          ),
        );
    }
  }
}
