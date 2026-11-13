import '../../domain/models/api/common.dart';
import '../../domain/models/api/comms.dart';
import 'api_transport.dart';

class CommsApi {
  final ApiTransport _t;
  CommsApi(this._t);

  Future<List<Conversation>> conversations(String familyId) async => decodeList(
        await _t.send('GET', '/v1/families/$familyId/conversations'),
        Conversation.fromJson,
      );

  Future<Page<Message>> messages(
    String conversationId, {
    String? cursor,
  }) async =>
      Page.fromJson(
        await _t.send(
          'GET',
          '/v1/conversations/$conversationId/messages${cursor == null ? '' : '?cursor=$cursor'}',
        ) as Map<String, dynamic>,
        Message.fromJson,
      );

  Future<Message> sendMessage(
    String conversationId,
    Map<String, dynamic> body,
  ) async =>
      Message.fromJson(
        await _t.send(
          'POST',
          '/v1/conversations/$conversationId/messages',
          body: body,
        ) as Map<String, dynamic>,
      );

  Future<void> markRead(String conversationId, String upToMessageId) async {
    await _t.send(
      'POST',
      '/v1/conversations/$conversationId/read',
      body: {'upTo': upToMessageId},
    );
  }

  Future<PhraseCatalogue> nudgePhrases() async => PhraseCatalogue.fromJson(
        await _t.send('GET', '/v1/nudge-phrases') as Map<String, dynamic>,
      );

  Future<Nudge> sendNudge(String familyId, Map<String, dynamic> body) async =>
      Nudge.fromJson(
        await _t.send('POST', '/v1/families/$familyId/nudges', body: body)
            as Map<String, dynamic>,
      );

  Future<void> replyNudge(String nudgeId, String reply) async {
    await _t.send('POST', '/v1/nudges/$nudgeId/reply', body: {'reply': reply});
  }

  Future<IceServers> iceServers() async => IceServers.fromJson(
        await _t.send('GET', '/v1/rtc/ice') as Map<String, dynamic>,
      );
}
