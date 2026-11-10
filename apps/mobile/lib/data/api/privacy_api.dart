import '../../domain/models/api/engage.dart';
import 'api_transport.dart';

class PrivacyApi {
  final ApiTransport _t;
  PrivacyApi(this._t);

  Future<Map<String, dynamic>> policy({String locale = 'bn'}) async =>
      await _t.send('GET', '/v1/policy?locale=$locale') as Map<String, dynamic>;

  Future<PrivacyRequest> requestExport() async => PrivacyRequest.fromJson(
        await _t.send('POST', '/v1/me/export') as Map<String, dynamic>,
      );

  Future<PrivacyRequest> exportStatus(String id) async =>
      PrivacyRequest.fromJson(
        await _t.send('GET', '/v1/me/export/$id') as Map<String, dynamic>,
      );

  Future<PrivacyRequest> requestErasure() async => PrivacyRequest.fromJson(
        await _t.send('POST', '/v1/me/erasure') as Map<String, dynamic>,
      );

  Future<void> cancelErasure() async {
    await _t.send('DELETE', '/v1/me/erasure');
  }
}
