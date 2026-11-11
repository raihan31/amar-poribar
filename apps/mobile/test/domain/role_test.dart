import 'package:amar_poribar/domain/models/role.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('fromWire maps the four server roles and falls back to viewer', () {
    expect(FamilyRole.fromWire('owner'), FamilyRole.owner);
    expect(FamilyRole.fromWire('admin'), FamilyRole.admin);
    expect(FamilyRole.fromWire('member'), FamilyRole.member);
    expect(FamilyRole.fromWire('viewer'), FamilyRole.viewer);
    expect(FamilyRole.fromWire('unknown'), FamilyRole.viewer);
  });

  test('rank orders owner > admin > member > viewer', () {
    expect(FamilyRole.owner.rank, greaterThan(FamilyRole.admin.rank));
    expect(FamilyRole.admin.rank, greaterThan(FamilyRole.member.rank));
    expect(FamilyRole.member.rank, greaterThan(FamilyRole.viewer.rank));
  });

  test('permissions per role', () {
    expect(FamilyRole.owner.canManageMembers, isTrue);
    expect(FamilyRole.admin.canManageMembers, isTrue);
    expect(FamilyRole.member.canManageMembers, isFalse);
    expect(FamilyRole.viewer.canManageMembers, isFalse);

    expect(FamilyRole.owner.canEditAll, isTrue);
    expect(FamilyRole.admin.canEditAll, isTrue);
    expect(FamilyRole.member.canEditAll, isFalse);
    expect(FamilyRole.viewer.canEditAll, isFalse);

    expect(FamilyRole.owner.canWriteLedger, isTrue);
    expect(FamilyRole.admin.canWriteLedger, isTrue);
    expect(FamilyRole.member.canWriteLedger, isTrue);
    expect(FamilyRole.viewer.canWriteLedger, isFalse);
  });
}
