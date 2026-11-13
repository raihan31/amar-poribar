import 'package:amar_poribar/data/api/family_api.dart';
import 'package:amar_poribar/features/family/data/invite_repository.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../data/api/api_test_helpers.dart';

Map<String, Object?> _preview(String state) => {
      'familyName': 'রহিম পরিবার',
      'memberCount': 5,
      'invitedBy': {'name': 'আব্বু'},
      'role': 'member',
      'expiresAt': '2026-11-15T04:00:00.000Z',
      'state': state,
    };

void main() {
  test('preview maps the wire shape', () async {
    final r = Recorder(_preview('valid'));
    final p =
        await ApiInviteRepository(FamilyApi(r.transport())).preview('abc');
    expect(r.url, '/v1/invites/abc');
    expect(p.familyName, 'রহিম পরিবার');
    expect(p.inviterName, 'আব্বু');
    expect(p.memberCount, 5);
    expect(p.daysLeft(DateTime.utc(2026, 11, 9, 4)), 6);
    expect(p.daysLeft(DateTime.utc(2026, 12, 1)), 0);
  });

  test('used and expired states become invite exceptions', () async {
    for (final (state, code) in [
      ('used', 'invite_used'),
      ('expired', 'invite_expired'),
      ('revoked', 'invite_expired'),
    ]) {
      final repo = ApiInviteRepository(
        FamilyApi(Recorder(_preview(state)).transport()),
      );
      await expectLater(
        repo.preview('abc'),
        throwsA(
          isA<InviteException>()
              .having((e) => e.code, 'code', code)
              .having((e) => e.inviterName, 'inviter', 'আব্বু'),
        ),
      );
    }
  });

  test('accept returns the family and maps a wrong phone', () async {
    final r = Recorder(_preview('valid'));
    final repo = ApiInviteRepository(FamilyApi(r.transport()));
    await repo.preview('abc');
    r.body = {'familyId': 'f1', 'role': 'member'};
    final f = await repo.accept('abc');
    expect([r.method, r.url], ['POST', '/v1/invites/abc/accept']);
    expect([f.id, f.name, f.role], ['f1', 'রহিম পরিবার', 'member']);

    r
      ..status = 403
      ..body = {
        'error': {'code': 'invite_wrong_phone', 'message': 'no'},
      };
    await expectLater(
      repo.accept('abc'),
      throwsA(
        isA<InviteException>()
            .having((e) => e.code, 'code', 'invite_not_for_you'),
      ),
    );
  });
}
