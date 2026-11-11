import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/domain/models/api/me.dart';
import 'package:amar_poribar/domain/models/role.dart';
import 'package:amar_poribar/features/family/data/fake_family_repository.dart';
import 'package:amar_poribar/features/family/state/family_providers.dart';
import 'package:amar_poribar/features/transactions/data/fake_transaction_repository.dart';
import 'package:amar_poribar/features/transactions/state/add_expense_controller.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

const _cats = [
  ('c-bazaar', 'bazaar', 'বাজার ও মুদি'),
  ('c-rent', 'rent', 'বাসা ভাড়া'),
  ('c-bill', 'electricity', 'বিদ্যুৎ বিল'),
  ('c-transport', 'transport', 'যাতায়াত'),
  ('c-other', 'other_expense', 'অন্যান্য'),
];

final List<CachedCategory> kFixtureCategories = [
  for (final (id, key, bn) in _cats)
    CachedCategory(
      id: id,
      key: key,
      kind: 'expense',
      nameEn: key,
      nameBn: bn,
      isHidden: false,
    ),
  const CachedCategory(
    id: 'c-hidden',
    key: 'gas',
    kind: 'expense',
    nameEn: 'gas',
    nameBn: 'গ্যাস বিল',
    isHidden: true,
  ),
  const CachedCategory(
    id: 'c-salary',
    key: 'salary',
    kind: 'income',
    nameEn: 'salary',
    nameBn: 'বেতন',
    isHidden: false,
  ),
];

const List<CachedAccount> kFixtureAccounts = [
  CachedAccount(
    id: 'a-cash',
    name: 'ক্যাশ',
    type: 'cash',
    balancePaisa: 0,
    archived: false,
    openingBalancePaisa: 0,
  ),
  CachedAccount(
    id: 'a-bkash',
    name: 'বিকাশ',
    type: 'bkash',
    balancePaisa: 0,
    archived: false,
    openingBalancePaisa: 0,
  ),
  CachedAccount(
    id: 'a-old',
    name: 'পুরোনো',
    type: 'bank',
    balancePaisa: 0,
    archived: true,
    openingBalancePaisa: 0,
  ),
];

/// Everything D4 reads, without a database: categories, accounts, role, family and a fake
/// transaction repository.
List<Override> addExpenseOverrides(
  FakeTransactionRepository repo, {
  FamilyRole role = FamilyRole.owner,
}) =>
    [
      transactionRepositoryProvider.overrideWithValue(repo),
      addCategoriesProvider.overrideWith((ref) async => kFixtureCategories),
      addAccountsProvider.overrideWith(
        (ref) => Stream.value([
          for (final a in kFixtureAccounts)
            if (!a.archived) a,
        ]),
      ),
      currentRoleFutureProvider.overrideWith((ref) async => role),
      myUserIdProvider.overrideWith((ref) async => FakeFamilyRepository.meId),
      currentFamilyProvider.overrideWith(
        (ref) async => const FamilyInfo(
          FakeFamilyRepository.familyId,
          'রহিম পরিবার',
          'owner',
        ),
      ),
    ];
