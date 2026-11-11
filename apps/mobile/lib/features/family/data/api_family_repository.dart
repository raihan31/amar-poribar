import '../../../data/api/family_api.dart';
import '../../../data/database/local_store.dart';
import '../../../domain/models/api/me.dart';
import '../../../domain/models/member.dart';
import '../../../domain/models/role.dart';
import 'family_list_repository.dart';
import 'family_repository.dart';

/// Real implementation over `GET /v1/families/:id/members`; members are cached so the screens
/// work offline.
class ApiFamilyRepository implements FamilyRepository {
  final FamilyApi api;
  final LocalStore store;
  ApiFamilyRepository(this.api, this.store);

  @override
  Stream<List<Member>> watchMembers(String familyId) =>
      store.watchMembers(familyId).map(
            (rows) => [
              for (final r in rows)
                Member(
                  userId: r.userId,
                  name: r.name,
                  role: FamilyRole.fromWire(r.role),
                  phoneLast3: r.phoneLast3,
                  avatarIndex: r.avatarIndex,
                ),
            ]..sort((a, b) => b.role.rank.compareTo(a.role.rank)),
          );

  @override
  Future<FamilyInfo> current() async {
    final families = await api.families();
    if (families.isEmpty) {
      throw StateError('The user belongs to no family');
    }
    return chooseActiveFamily(families, await store.getMeta(kActiveFamilyKey));
  }

  @override
  Future<void> refresh(String familyId) async {
    final members = await api.members(familyId);
    await store.replaceMembers(familyId, [
      for (var i = 0; i < members.length; i++)
        {
          'userId': members[i].userId,
          'name': members[i].name ?? '',
          'role': members[i].role,
          'phoneLast3': _last3(members[i].phone),
          'avatarIndex': i,
        },
    ]);
  }

  static String _last3(String phone) =>
      phone.length <= 3 ? phone : phone.substring(phone.length - 3);
}
