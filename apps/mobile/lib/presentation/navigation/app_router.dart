import 'package:flutter/material.dart';

import '../screens/ai_entry_screen.dart';
import '../screens/login_screen.dart';
import '../screens/onboarding_screen.dart';
import '../screens/dashboard_screen.dart';
import '../screens/transaction_screen.dart';
import '../screens/settings_screen.dart';
import '../screens/tutorial_screen.dart'; // contains PendingSmsScreen too

class AppRouter {
  static const String onboardingRoute = '/';
  static const String dashboardRoute = '/dashboard';
  static const String transactionsRoute = '/transactions';
  static const String pendingSmsRoute = '/pending-sms';
  static const String settingsRoute = '/settings';
  static const String loginRoute = '/login';
  static const String aiEntryRoute = '/ai-entry';
  static const String tutorialRoute = '/tutorial';

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
      case loginRoute:
        return MaterialPageRoute(builder: (_) => const LoginScreen());
      case tutorialRoute:
        return MaterialPageRoute(builder: (_) => const TutorialScreen());
      case aiEntryRoute:
        return MaterialPageRoute(builder: (_) => const AiEntryScreen());
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
