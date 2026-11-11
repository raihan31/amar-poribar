/// A member's role in a family, as the server names it (SRS FR-FAM-03).
enum FamilyRole {
  owner,
  admin,
  member,
  viewer;

  /// Reads the wire value; anything unknown is the least privileged role.
  static FamilyRole fromWire(String? value) => FamilyRole.values.firstWhere(
        (r) => r.name == value,
        orElse: () => FamilyRole.viewer,
      );

  /// Higher means more privileged.
  int get rank => switch (this) {
        FamilyRole.owner => 3,
        FamilyRole.admin => 2,
        FamilyRole.member => 1,
        FamilyRole.viewer => 0,
      };

  bool get canManageMembers => rank >= FamilyRole.admin.rank;
  bool get canEditAll => rank >= FamilyRole.admin.rank;
  bool get canWriteLedger => rank >= FamilyRole.member.rank;
}
