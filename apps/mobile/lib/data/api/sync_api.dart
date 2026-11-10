import '../../domain/models/api/sync.dart';
import 'api_transport.dart';

class SyncApi {
  final ApiTransport _t;
  SyncApi(this._t);

  /// Exchange transaction changes with the server (SRS 4.3.1). [cursor] is the value from the last response.
  Future<SyncResponse> sync(
    String familyId,
    String nodeId,
    String? cursor,
    List<Map<String, dynamic>> changes,
  ) async =>
      SyncResponse.fromJson(
        await _t.send(
          'POST',
          '/v1/families/$familyId/sync',
          body: {
            'nodeId': nodeId,
            'cursor': cursor,
            'changes': {'transactions': changes},
          },
        ) as Map<String, dynamic>,
      );
}
