import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/ui/login_screen.dart';
import '../features/auth/ui/session_expired_screen.dart';
import '../features/family/ui/join_screen.dart';
import '../features/onboarding/ui/consent_screen.dart';
import '../features/onboarding/ui/policy_screen.dart';
import '../features/onboarding/ui/tutorial_screen.dart';
import '../features/onboarding/ui/welcome_screen.dart';
import '../features/settings/ui/profile_screen.dart';
import '../features/transactions/ui/add_expense_screen.dart';
import '../features/voice/ui/voice_fallback_screen.dart';
import '../presentation/providers/auth_provider.dart';
import '../presentation/screens/ai_entry_screen.dart';
import '../presentation/screens/dashboard_screen.dart';
import '../presentation/screens/settings_screen.dart';
import '../presentation/screens/transaction_screen.dart';
import 'redirects.dart';
import 'screens.dart';
import 'shell.dart';

export 'redirects.dart' show Routes;

/// Builds the stand-in for routes whose screens are not written yet. Tests override it.
final placeholderBuilderProvider = Provider<Widget Function(String routeName)>(
  (ref) => (name) => PlaceholderScreen(name),
);

/// Feeds a link (notification tap, invite, call) into the router.
final deepLinkProvider = Provider<void Function(String location)>(
  (ref) => (location) => ref.read(routerProvider).go(location),
);

final routerProvider = Provider<GoRouter>((ref) {
  final rootKey = GlobalKey<NavigatorState>(debugLabel: 'root');
  final refresh = ValueNotifier<int>(0);
  void poke(Object? _, Object? __) => refresh.value++;
  ref.listen(authProvider, poke);
  ref.listen(welcomeDoneProvider, poke);
  ref.listen(tutorialDoneProvider, poke);
  ref.listen(consentCurrentProvider, poke);

  Widget placeholder(String name) => ref.read(placeholderBuilderProvider)(name);

  GoRoute simple(String path, Widget Function(GoRouterState s) build) =>
      GoRoute(
        path: path,
        parentNavigatorKey: rootKey,
        builder: (context, state) => build(state),
      );
  GoRoute stub(String path) => simple(path, (_) => placeholder(path));
  GoRoute tab(String path, Widget Function() build) =>
      GoRoute(path: path, builder: (context, state) => build());

  final router = GoRouter(
    navigatorKey: rootKey,
    initialLocation: Routes.home,
    refreshListenable: refresh,
    redirect: (context, state) => redirect(ref, state),
    errorBuilder: (context, state) => const ErrorScreen(),
    routes: [
      simple(Routes.welcome, (_) => const WelcomeScreen()),
      simple(
        Routes.login,
        (s) => LoginScreen(from: s.uri.queryParameters['from']),
      ),
      simple(
        Routes.loginCode,
        (s) => LoginScreen(
          phase: LoginPhase.code,
          from: s.uri.queryParameters['from'],
        ),
      ),
      simple(Routes.consent, (_) => const ConsentScreen()),
      simple(
        Routes.join,
        (s) => JoinScreen(token: s.pathParameters['token']!),
      ),
      simple(Routes.tutorial, (_) => const TutorialScreen()),
      simple(
        Routes.sessionExpired,
        (s) => SessionExpiredScreen(from: s.uri.queryParameters['from']),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => AppShell(navigationShell: shell),
        branches: [
          StatefulShellBranch(
            routes: [tab(Routes.home, () => const DashboardScreen())],
          ),
          StatefulShellBranch(
            routes: [tab(Routes.talk, () => placeholder(Routes.talk))],
          ),
          StatefulShellBranch(
            routes: [tab(Routes.list, () => placeholder(Routes.list))],
          ),
          StatefulShellBranch(
            routes: [tab(Routes.budget, () => placeholder(Routes.budget))],
          ),
          StatefulShellBranch(
            routes: [tab(Routes.family, () => placeholder(Routes.family))],
          ),
        ],
      ),
      stub(Routes.buzz),
      stub(Routes.buzzIncoming),
      stub(Routes.conversation),
      stub(Routes.voiceNote),
      stub(Routes.call),
      simple(Routes.add, (_) => const AddExpenseScreen()),
      // Until T-MOB-28 builds the voice screen, the old entry screen stays reachable here.
      simple(Routes.addVoice, (_) => const AiEntryScreen()),
      stub(Routes.txn),
      stub(Routes.receipt),
      stub(Routes.ruleLearn),
      simple(Routes.voiceFallback, (_) => const VoiceFallbackScreen()),
      stub(Routes.summary),
      stub(Routes.ask),
      simple(Routes.settings, (_) => const SettingsScreen()),
      simple(Routes.profile, (_) => const ProfileScreen()),
      simple(Routes.consentPolicy, (_) => const PolicyScreen()),
      stub(Routes.accounts),
      stub(Routes.categories),
      stub(Routes.recurring),
      stub(Routes.festivalNew),
      stub(Routes.reports),
      stub(Routes.remit),
      stub(Routes.plans),
      stub(Routes.dhar),
      stub(Routes.families),
      stub(Routes.notifications),
      stub(Routes.sync),
      stub(Routes.bazaar),
      stub(Routes.deleteAccount),
      stub(Routes.simple),
      simple(Routes.transactions, (_) => const TransactionScreen()),
      simple(Routes.pendingSms, (_) => const PendingSmsScreen()),
    ],
  );
  ref.onDispose(() {
    router.dispose();
    refresh.dispose();
  });
  return router;
});
