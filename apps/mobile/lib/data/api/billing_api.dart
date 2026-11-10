import '../../domain/models/api/common.dart';
import '../../domain/models/api/engage.dart';
import 'api_transport.dart';

class BillingApi {
  final ApiTransport _t;
  BillingApi(this._t);

  Future<List<Plan>> plans() async =>
      decodeList(await _t.send('GET', '/v1/plans'), Plan.fromJson);

  Future<Subscription> subscription(String familyId) async =>
      Subscription.fromJson(
        await _t.send('GET', '/v1/families/$familyId/subscription')
            as Map<String, dynamic>,
      );

  Future<Map<String, dynamic>> checkout(
    String familyId,
    Map<String, dynamic> body,
  ) async =>
      await _t.send(
        'POST',
        '/v1/families/$familyId/subscription/checkout',
        body: body,
      ) as Map<String, dynamic>;

  Future<void> cancel(String familyId) async {
    await _t.send('POST', '/v1/families/$familyId/subscription/cancel');
  }

  Future<List<Invoice>> invoices(String familyId) async => decodeList(
        await _t.send('GET', '/v1/families/$familyId/subscription/invoices'),
        Invoice.fromJson,
      );
}
