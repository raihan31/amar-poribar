// ignore_for_file: file_names
import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/domain/models/api/me.dart';
import 'package:amar_poribar/features/family/data/fake_family_repository.dart';
import 'package:amar_poribar/features/family/state/active_family.dart';
import 'package:amar_poribar/features/home/data/home_repository.dart';
import 'package:amar_poribar/features/home/state/home_providers.dart';
import 'package:amar_poribar/features/home/ui/home_screen.dart';
import 'package:amar_poribar/ui/bottom_tabs.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'golden_config.dart';

/// Board: Main.dc.html. The shell's tab bar is added so the whole 390 x 844 board is compared.
final _overrides = <Override>[
  activeFamilyProvider.overrideWithValue(
    const FamilyInfo(FakeFamilyRepository.familyId, 'রহিম পরিবার', 'owner'),
  ),
  // 12:00 UTC = 18:00 in Dhaka: "শুভ সন্ধ্যা".
  homeClockProvider.overrideWithValue(() => DateTime.utc(2026, 11, 9, 12)),
  homeRepositoryProvider.overrideWithValue(
    FakeHomeRepository(
      expenses: [
        ActivityItem(
          kind: ActivityKind.expense,
          at: DateTime.utc(2026, 11, 9, 10),
          id: 't1',
          memberId: FakeFamilyRepository.meId,
          note: 'বিদ্যুৎ বিল',
          amountPaisa: 234000,
        ),
      ],
    ),
  ),
  chatActivityProvider.overrideWithValue([
    ActivityItem(
      kind: ActivityKind.voice,
      at: DateTime.utc(2026, 11, 9, 11),
      memberId: 'u-ammu',
      voiceSeconds: 12,
    ),
  ]),
  topBudgetWarningProvider.overrideWithValue(
    const TopBudgetWarning(
      budget: CachedBudget(
        id: 'b1',
        familyId: FakeFamilyRepository.familyId,
        categoryId: 'bazar',
        month: '2026-11',
        limitPaisa: 1000000,
        spentPaisa: 800000,
        level: 'warning',
      ),
      name: 'বাজারের',
      percent: 80,
    ),
  ),
];

Widget _screen() => const Scaffold(
      body: HomeScreen(),
      bottomNavigationBar: _Tabs(),
    );

class _Tabs extends StatelessWidget {
  const _Tabs();

  @override
  Widget build(BuildContext context) =>
      AppBottomTabs(index: 0, onSelect: (_) {}, chatBadge: 2);
}

void main() {
  goldenScreen('Main_home', _screen(), overrides: _overrides);
  goldenScreen('Main_home', _screen(), overrides: _overrides, dark: true);
}
