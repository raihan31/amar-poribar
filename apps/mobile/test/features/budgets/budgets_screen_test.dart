import 'package:amar_poribar/domain/models/member.dart';
import 'package:amar_poribar/domain/models/role.dart';
import 'package:amar_poribar/features/budgets/data/budget_repository.dart';
import 'package:amar_poribar/features/budgets/state/budget_providers.dart';
import 'package:amar_poribar/features/budgets/ui/budgets_screen.dart';
import 'package:amar_poribar/features/family/state/family_providers.dart';
import 'package:amar_poribar/features/home/state/home_providers.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fake_voice_service.dart';
import '../../helpers/pump_app.dart';

final _budgets = [
  const BudgetStatus(null, 'মোট', 5000000, 4250000, 'warning'),
  const BudgetStatus('c1', 'বাজার ও মুদি', 1000000, 1050000, 'exceeded'),
  const BudgetStatus('c2', 'যাতায়াত', 300000, 120000, 'ok'),
];

List<Override> _over({FamilyRole role = FamilyRole.owner}) => [
  budgetRepositoryProvider.overrideWithValue(
    FakeBudgetRepository(budgets: _budgets),
  ),
  currentRoleProvider.overrideWithValue(role),
  budgetRecipientProvider.overrideWithValue(
    const Member(userId: 'u-ammu', name: 'আম্মু', role: FamilyRole.admin),
  ),
  homeClockProvider.overrideWithValue(() => DateTime.utc(2026, 11, 9, 4)),
];

Future<void> _settle(WidgetTester t) async {
  await t.pump();
  await t.pump(const Duration(milliseconds: 50));
  await t.pump(const Duration(milliseconds: 50));
}

void main() {
  testWidgets('three states render the exact status strings', (t) async {
    await pumpApp(t, const BudgetsScreen(), overrides: _over());
    await _settle(t);
    expect(find.text('মাসের বাজেট'), findsOneWidget);
    expect(find.text('ঠিক আছে'), findsOneWidget);
    expect(find.text('৮৫% পার হয়েছে · সাবধান'), findsOneWidget);
    expect(find.text('বাজেট শেষ · ৳ ৫০০ বেশি'), findsOneWidget);
    expect(find.text('৳ ১০,৫০০ / ১০,০০০'), findsOneWidget);
    expect(find.text('আম্মুকে কম্পন দিন'), findsOneWidget);
    expect(find.text('+ বাজেট দিন'), findsOneWidget);
    expect(find.text('পুরো পরিবার'), findsOneWidget);
  });

  testWidgets('a member sees read-only cards, no edit button', (t) async {
    await pumpApp(
      t,
      const BudgetsScreen(),
      overrides: _over(role: FamilyRole.member),
    );
    await _settle(t);
    expect(find.text('+ বাজেট দিন'), findsNothing);
    expect(find.text('বাজার ও মুদি'), findsOneWidget);
  });

  testWidgets('the speaker button speaks every non-ok alert', (t) async {
    await pumpApp(t, const BudgetsScreen(), overrides: _over());
    await _settle(t);
    await t.tap(find.bySemanticsLabel('শুনুন'));
    await _settle(t);
    final voice = appContainer(t).read(voiceServiceProvider);
    expect((voice as FakeVoiceService).spoken, hasLength(2));
  });
}
