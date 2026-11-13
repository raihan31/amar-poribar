import '../../domain/models/api/common.dart';
import '../../domain/models/api/engage.dart';
import 'api_transport.dart';

class LendingApi {
  final ApiTransport _t;
  LendingApi(this._t);

  Future<List<Dhar>> list(String familyId) async => decodeList(
        await _t.send('GET', '/v1/families/$familyId/dhar'),
        Dhar.fromJson,
      );

  Future<Dhar> create(String familyId, Map<String, dynamic> body) async =>
      Dhar.fromJson(
        await _t.send('POST', '/v1/families/$familyId/dhar', body: body)
            as Map<String, dynamic>,
      );

  Future<void> repay(String familyId, String dharId, int amountPaisa) async {
    await _t.send(
      'POST',
      '/v1/families/$familyId/dhar/$dharId/repayments',
      body: {'amountPaisa': amountPaisa},
    );
  }

  Future<void> delete(String familyId, String dharId) async {
    await _t.send('DELETE', '/v1/families/$familyId/dhar/$dharId');
  }
}
