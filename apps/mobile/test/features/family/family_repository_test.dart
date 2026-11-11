import 'package:amar_poribar/domain/models/role.dart';
import 'package:amar_poribar/features/family/data/fake_family_repository.dart';
import 'package:amar_poribar/features/family/state/family_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('fake emits the design members with their roles', () async {
    final repo = FakeFamilyRepository();
    final info = await repo.current();
    final members = await repo.watchMembers(info.id).first;
    expect(members.map((m) => m.name), ['আব্বু', 'আম্মু', 'দাদি', 'তানভীর']);
    expect(members.map((m) => m.role), [
      FamilyRole.owner,
      FamilyRole.admin,
      FamilyRole.member,
      FamilyRole.viewer,
    ]);
    expect(repo.pendingInvitePhone, '০১৭৯৮ ৭৬৫ ৪৩২');
    await repo.refresh(info.id);
  });

  test('role ranks are non-increasing in the fake list', () async {
    final repo = FakeFamilyRepository();
    final info = await repo.current();
    final members = await repo.watchMembers(info.id).first;
    final ranks = members.map((m) => m.role.rank).toList();
    expect([...ranks]..sort((a, b) => b.compareTo(a)), ranks);
  });

  test('currentRoleProvider is derived from members and my user id', () async {
    final c = ProviderContainer(
      overrides: [
        familyRepositoryProvider.overrideWithValue(FakeFamilyRepository()),
        myUserIdProvider.overrideWith((ref) async => FakeFamilyRepository.meId),
      ],
    );
    addTearDown(c.dispose);
    c.listen(currentRoleProvider, (_, __) {});
    expect(await c.read(currentRoleFutureProvider.future), FamilyRole.owner);
    expect(c.read(currentRoleProvider), FamilyRole.owner);
  });
}
