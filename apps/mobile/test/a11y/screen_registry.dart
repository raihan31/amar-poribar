import 'package:amar_poribar/app/redirects.dart';
import 'package:amar_poribar/domain/models/api/me.dart';
import 'package:amar_poribar/domain/models/member.dart';
import 'package:amar_poribar/domain/models/role.dart';
import 'package:amar_poribar/features/auth/data/auth_repository.dart';
import 'package:amar_poribar/features/auth/data/fake_auth_repository.dart';
import 'package:amar_poribar/features/auth/ui/login_screen.dart';
import 'package:amar_poribar/features/auth/ui/session_expired_screen.dart';
import 'package:amar_poribar/features/budgets/data/budget_repository.dart';
import 'package:amar_poribar/features/budgets/state/budget_providers.dart';
import 'package:amar_poribar/features/budgets/ui/budgets_screen.dart';
import 'package:amar_poribar/features/entry/data/fake_entry_repository.dart';
import 'package:amar_poribar/features/entry/state/entry_controller.dart';
import 'package:amar_poribar/features/entry/ui/category_picker_screen.dart';
import 'package:amar_poribar/features/entry/ui/voice_entry_screen.dart';
import 'package:amar_poribar/features/family/data/fake_family_repository.dart';
import 'package:amar_poribar/features/family/data/invite_repository.dart';
import 'package:amar_poribar/features/family/state/active_family.dart';
import 'package:amar_poribar/features/family/state/family_providers.dart';
import 'package:amar_poribar/features/family/ui/join_screen.dart';
import 'package:amar_poribar/features/home/data/home_repository.dart';
import 'package:amar_poribar/features/home/state/home_providers.dart';
import 'package:amar_poribar/features/home/ui/home_screen.dart';
import 'package:amar_poribar/features/onboarding/data/fake_onboarding_repository.dart';
import 'package:amar_poribar/features/onboarding/data/onboarding_repository.dart';
import 'package:amar_poribar/features/onboarding/ui/consent_screen.dart';
import 'package:amar_poribar/features/onboarding/ui/tutorial_screen.dart';
import 'package:amar_poribar/features/onboarding/ui/welcome_screen.dart';
import 'package:amar_poribar/features/settings/state/preferences_controller.dart';
import 'package:amar_poribar/features/settings/ui/settings_screen.dart';
import 'package:amar_poribar/features/summary/data/fake_summary_repository.dart';
import 'package:amar_poribar/features/summary/state/summary_providers.dart';
import 'package:amar_poribar/features/summary/ui/summary_screen.dart';
import 'package:amar_poribar/features/transactions/data/fake_transaction_repository.dart';
import 'package:amar_poribar/features/transactions/ui/add_expense_screen.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/transactions/add_expense_fixtures.dart';
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
    'A2',
    Routes.consent,
    (c) => const ConsentScreen(),
    needs: [
      onboardingRepositoryProvider.overrideWithValue(
        FakeOnboardingRepository(),
      ),
    ],
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
  registerScreen('D2', Routes.tutorial, (c) => const TutorialScreen());
  registerScreen(
    'D4',
    Routes.add,
    (c) => const AddExpenseScreen(),
    needs: addExpenseOverrides(FakeTransactionRepository()),
  );
  registerScreen(
    'B2',
    Routes.summary,
    (c) => const SummaryScreen(),
    needs: [
      summaryRepositoryProvider.overrideWithValue(FakeSummaryRepository()),
    ],
  );
  registerScreen(
    'A4',
    Routes.addCategory,
    (c) => const CategoryPickerScreen(
      args: CategoryPickerArgs(amountPaisa: 50000, caption: 'ক্যাশ · আজ'),
    ),
    needs: addExpenseOverrides(FakeTransactionRepository()),
  );
  registerScreen(
    'A3',
    Routes.addVoice,
    (c) => const VoiceEntryScreen(
      initialText: 'আজ বাজারে আটশো পঞ্চাশ টাকা ক্যাশে',
    ),
    needs: [
      ...addExpenseOverrides(FakeTransactionRepository()),
      entryRepositoryProvider.overrideWithValue(FakeEntryRepository()),
    ],
  );
  registerScreen(
    'B3',
    Routes.budget,
    (c) => const BudgetsScreen(),
    needs: [
      budgetRepositoryProvider.overrideWithValue(
        FakeBudgetRepository(
          budgets: const [
            BudgetStatus(null, 'মোট', 5000000, 4250000, 'warning'),
            BudgetStatus('c1', 'বাজার ও মুদি', 1000000, 1050000, 'exceeded'),
            BudgetStatus('c2', 'যাতায়াত', 300000, 120000, 'ok'),
          ],
        ),
      ),
      currentRoleProvider.overrideWithValue(FamilyRole.owner),
      budgetRecipientProvider.overrideWithValue(
        const Member(userId: 'u-ammu', name: 'আম্মু', role: FamilyRole.admin),
      ),
    ],
  );
  registerScreen(
    'Main',
    Routes.home,
    (c) => const HomeScreen(),
    needs: [
      activeFamilyProvider.overrideWithValue(
        const FamilyInfo(
          FakeFamilyRepository.familyId,
          'রহিম পরিবার',
          'owner',
        ),
      ),
      homeRepositoryProvider.overrideWithValue(FakeHomeRepository()),
    ],
  );
  registerScreen(
    'B6',
    Routes.settings,
    (c) => const SettingsScreen(),
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
  Routes.login,
  Routes.consent,
  Routes.sessionExpired,
  Routes.join,
  Routes.add,
  Routes.addVoice,
  Routes.addCategory,
  Routes.tutorial,
  Routes.summary,
  Routes.budget,
];

/// Pre-existing screens not yet in the audit. Each screen task removes its
/// route from this list when it registers the screen. The list may only
/// shrink: `registry_complete_test.dart` fails if a route is in neither place.
const Set<String> kRoutesAwaitingRegistration = {
  Routes.transactions,
};
