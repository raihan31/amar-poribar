import '../../../domain/models/api/me.dart';
import '../../../domain/models/member.dart';

/// Family and member state. The real one reads the API and caches into `CachedMembers`; tests
/// use `FakeFamilyRepository`.
abstract class FamilyRepository {
  /// Members of [familyId], newest cache first; emits again after [refresh].
  Stream<List<Member>> watchMembers(String familyId);

  /// The family the app is showing (the first one of `GET /v1/me`).
  Future<FamilyInfo> current();

  /// Fetches members from the server into the cache.
  Future<void> refresh(String familyId);
}
