import '../../../data/api/family_api.dart';
import '../../../domain/models/api/me.dart';

/// Meta key holding the family the user last chose on this device (FR-FAM-04).
const kActiveFamilyKey = 'active_family';

/// The families of `GET /v1/me`.
class FamilyListRepository {
  final FamilyApi api;
  FamilyListRepository(this.api);

  Future<List<FamilyInfo>> list() => api.families();
}

/// The stored choice when the user is still a member of it, else the first family.
/// [families] must not be empty.
FamilyInfo chooseActiveFamily(List<FamilyInfo> families, String? storedId) {
  for (final f in families) {
    if (f.id == storedId) return f;
  }
  return families[0];
}
