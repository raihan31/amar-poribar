import '../../domain/models/api/common.dart';
import '../../domain/models/api/family.dart';
import '../../domain/models/api/me.dart';
import 'api_transport.dart';

class FamilyApi {
  final ApiTransport _t;
  FamilyApi(this._t);

  Future<Me> me() async =>
      Me.fromJson(await _t.send('GET', '/v1/me') as Map<String, dynamic>);

  /// Only the family list of `/v1/me` (what the app needs to pick a family).
  Future<List<FamilyInfo>> families() async {
    final r = await _t.send('GET', '/v1/me') as Map<String, dynamic>;
    return decodeList(r['families'], FamilyInfo.fromJson);
  }

  Future<Family> createFamily(String name) async => Family.fromJson(
        await _t.send('POST', '/v1/families', body: {'name': name})
            as Map<String, dynamic>,
      );

  Future<Family> family(String familyId) async => Family.fromJson(
        await _t.send('GET', '/v1/families/$familyId') as Map<String, dynamic>,
      );

  Future<List<ApiMember>> members(String familyId) async => decodeList(
        await _t.send('GET', '/v1/families/$familyId/members'),
        ApiMember.fromJson,
      );

  Future<Map<String, dynamic>> invite(
    String familyId,
    Map<String, dynamic> body,
  ) async =>
      await _t.send('POST', '/v1/families/$familyId/invites', body: body)
          as Map<String, dynamic>;

  /// `GET /v1/invites/:token` (public preview).
  Future<Map<String, dynamic>> invitePreview(String token) async =>
      await _t.send('GET', '/v1/invites/$token') as Map<String, dynamic>;

  /// `POST /v1/invites/:token/accept`; the body is `{familyId, role}`.
  Future<Map<String, dynamic>> acceptInvite(String token) async =>
      (await _t.send('POST', '/v1/invites/$token/accept'))
          as Map<String, dynamic>? ??
      const {};

  Future<void> removeMember(String familyId, String userId) async {
    await _t.send('DELETE', '/v1/families/$familyId/members/$userId');
  }
}
