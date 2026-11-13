import '../../domain/models/api/common.dart';
import '../../domain/models/api/ledger.dart';
import 'api_transport.dart';

class LedgerApi {
  final ApiTransport _t;
  LedgerApi(this._t);

  Future<List<ApiCategory>> categories(String familyId) async => decodeList(
        await _t.send('GET', '/v1/families/$familyId/categories'),
        ApiCategory.fromJson,
      );

  Future<List<ApiAccount>> accounts(String familyId) async => decodeList(
        await _t.send('GET', '/v1/families/$familyId/accounts'),
        ApiAccount.fromJson,
      );

  Future<ApiAccount> createAccount(
    String familyId,
    Map<String, dynamic> body,
  ) async =>
      ApiAccount.fromJson(
        await _t.send('POST', '/v1/families/$familyId/accounts', body: body)
            as Map<String, dynamic>,
      );

  Future<List<ApiTransaction>> transactions(
    String familyId, {
    int? limit,
  }) async =>
      decodeList(
        await _t.send(
          'GET',
          '/v1/families/$familyId/transactions${limit == null ? '' : '?limit=$limit'}',
        ),
        ApiTransaction.fromJson,
      );

  Future<ApiTransaction> createTransaction(
    String familyId,
    Map<String, dynamic> body,
  ) async =>
      ApiTransaction.fromJson(
        await _t.send(
          'POST',
          '/v1/families/$familyId/transactions',
          body: body,
        ) as Map<String, dynamic>,
      );

  Future<ApiTransaction> updateTransaction(
    String familyId,
    String txnId,
    Map<String, dynamic> patch,
  ) async =>
      ApiTransaction.fromJson(
        await _t.send(
          'PATCH',
          '/v1/families/$familyId/transactions/$txnId',
          body: patch,
        ) as Map<String, dynamic>,
      );

  Future<void> deleteTransaction(String familyId, String txnId) async {
    await _t.send('DELETE', '/v1/families/$familyId/transactions/$txnId');
  }
}
