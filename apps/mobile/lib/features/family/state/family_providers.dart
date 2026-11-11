import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/api/api_providers.dart';
import '../../../domain/models/api/me.dart';
import '../../../domain/models/member.dart';
import '../../../domain/models/role.dart';
import '../../../presentation/providers/providers.dart';
import '../data/api_family_repository.dart';
import '../data/family_repository.dart';

/// The real repository; tests override it with `FakeFamilyRepository`.
final familyRepositoryProvider = Provider<FamilyRepository>(
  (ref) => ApiFamilyRepository(
    ref.watch(familyApiProvider),
    ref.watch(localStoreProvider),
  ),
);

/// `GET /v1/me`.
final meProvider = FutureProvider<Me>(
  (ref) => ref.watch(familyApiProvider).me(),
);

/// My user id, from `GET /v1/me`. Tests override it.
final myUserIdProvider = FutureProvider<String>(
  (ref) async => (await ref.watch(meProvider.future)).user.id,
);

final currentFamilyProvider = FutureProvider<FamilyInfo>(
  (ref) => ref.watch(familyRepositoryProvider).current(),
);

final membersProvider = StreamProvider<List<Member>>((ref) async* {
  final repo = ref.watch(familyRepositoryProvider);
  final family = await ref.watch(currentFamilyProvider.future);
  yield* repo.watchMembers(family.id);
});

/// My role in the current family, derived from the members and my user id.
final currentRoleFutureProvider = FutureProvider<FamilyRole>((ref) async {
  final me = await ref.watch(myUserIdProvider.future);
  final members = await ref.watch(membersProvider.future);
  for (final m in members) {
    if (m.userId == me) return m.role;
  }
  return FamilyRole.viewer;
});

/// Synchronous view of [currentRoleFutureProvider]; the least privileged role until it loads.
final currentRoleProvider = Provider<FamilyRole>(
  (ref) =>
      ref.watch(currentRoleFutureProvider).valueOrNull ?? FamilyRole.viewer,
);
