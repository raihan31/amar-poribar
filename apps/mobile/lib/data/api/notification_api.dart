import '../../domain/models/api/common.dart';
import '../../domain/models/api/engage.dart';
import 'api_transport.dart';

class NotificationApi {
  final ApiTransport _t;
  NotificationApi(this._t);

  Future<Page<InboxItem>> inbox({String? cursor}) async {
    final q = cursor == null ? '' : '?cursor=$cursor';
    return Page.fromJson(
      await _t.send('GET', '/v1/inbox$q') as Map<String, dynamic>,
      InboxItem.fromJson,
    );
  }

  Future<void> markRead(List<String> ids) async {
    await _t.send('POST', '/v1/inbox/read', body: {'ids': ids});
  }

  Future<void> clearInbox() async {
    await _t.send('DELETE', '/v1/inbox');
  }

  Future<Preferences> preferences() async => Preferences.fromJson(
        await _t.send('GET', '/v1/me/notification-preferences')
            as Map<String, dynamic>,
      );

  Future<Preferences> savePreferences(Preferences p) async =>
      Preferences.fromJson(
        await _t.send(
          'PUT',
          '/v1/me/notification-preferences',
          body: p.toJson(),
        ) as Map<String, dynamic>,
      );
}
