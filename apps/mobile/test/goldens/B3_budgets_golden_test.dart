// ignore_for_file: file_names
import 'package:amar_poribar/domain/models/member.dart';
import 'package:amar_poribar/domain/models/role.dart';
import 'package:amar_poribar/features/budgets/data/budget_repository.dart';
import 'package:amar_poribar/features/budgets/state/budget_providers.dart';
import 'package:amar_poribar/features/budgets/ui/budgets_screen.dart';
import 'package:amar_poribar/features/family/state/family_providers.dart';
import 'package:amar_poribar/features/home/state/home_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'golden_config.dart';

/// Board: Budgets.dc.html (November 2026).
List<Override> _overrides() => [
      budgetRepositoryProvider.overrideWithValue(
        FakeBudgetRepository(
          budgets: const [
            BudgetStatus(null, 'মোট', 5000000, 4250000, 'warning'),
            BudgetStatus('c1', 'বাজার ও মুদি', 1000000, 1050000, 'exceeded'),
            BudgetStatus('c2', 'যাতায়াত', 300000, 120000, 'ok'),
          ],
          festivalList: const [
            FestivalBudget(
              id: 'f1',
              name: 'ঈদুল আযহা',
              limitPaisa: 2000000,
              spentPaisa: 0,
              startsOn: '2027-06-15',
              endsOn: '2027-06-20',
            ),
          ],
        ),
      ),
      currentRoleProvider.overrideWithValue(FamilyRole.owner),
      budgetRecipientProvider.overrideWithValue(
        const Member(userId: 'u-ammu', name: 'আম্মু', role: FamilyRole.admin),
      ),
      homeClockProvider.overrideWithValue(() => DateTime.utc(2026, 11, 9, 4)),
    ];

void main() {
  goldenScreen('B3_budgets', const BudgetsScreen(), overrides: _overrides());
  goldenScreen(
    'B3_budgets',
    const BudgetsScreen(),
    overrides: _overrides(),
    dark: true,
  );
}
