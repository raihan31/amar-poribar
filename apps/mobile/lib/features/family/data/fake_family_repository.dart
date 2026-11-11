import '../../../domain/models/api/me.dart';
import '../../../domain/models/member.dart';
import '../../../domain/models/role.dart';
import 'family_repository.dart';

/// The family of the design board (Family.dc.html): me (আব্বু, owner), আম্মু, দাদি, তানভীর and a
/// pending invite.
class FakeFamilyRepository implements FamilyRepository {
  static const meId = 'u-abbu';
  static const familyId = 'f-rahim';

  /// The pending invite shown on the board.
  final String pendingInvitePhone = '০১৭৯৮ ৭৬৫ ৪৩২';

  List<Member> _members = const [
    Member(
      userId: meId,
      name: 'আব্বু',
      role: FamilyRole.owner,
      phoneLast3: '001',
      avatarIndex: 0,
      online: true,
    ),
    Member(
      userId: 'u-ammu',
      name: 'আম্মু',
      role: FamilyRole.admin,
      phoneLast3: '002',
      avatarIndex: 1,
      online: true,
    ),
    Member(
      userId: 'u-dadi',
      name: 'দাদি',
      role: FamilyRole.member,
      phoneLast3: '003',
      avatarIndex: 2,
    ),
    Member(
      userId: 'u-tanvir',
      name: 'তানভীর',
      role: FamilyRole.viewer,
      phoneLast3: '004',
      avatarIndex: 3,
    ),
  ];

  @override
  Stream<List<Member>> watchMembers(String familyId) async* {
    yield _members;
  }

  @override
  Future<FamilyInfo> current() async =>
      const FamilyInfo(familyId, 'রহিম পরিবার', 'owner');

  @override
  Future<void> refresh(String familyId) async {
    _members = List.of(_members);
  }
}
