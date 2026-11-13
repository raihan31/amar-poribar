import 'package:amar_poribar/data/api/api_transport.dart';
import 'package:amar_poribar/data/api/notification_api.dart';
import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/features/notifications/data/inbox_repository.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

class _Transport extends ApiTransport {
  _Transport(this.pages)
      : super(MockClient((_) async => http.Response('', 500)), 'http://x');

  final List<String> calls = [];
  final Map<String?, Map<String, dynamic>> pages;

  @override
  Future<dynamic> send(String method, String path, {Object? body}) async {
    calls.add('$method $path');
    if (method == 'GET') {
      return pages[Uri.parse(path).queryParameters['cursor']];
    }
    return null;
  }
}

Map<String, dynamic> _json(String id, String createdAt) => {
      'id': id,
      'kind': 'budget',
      'title': 't$id',
      'body': 'b',
      'speechText': null,
      'data': {'k': 'v'},
      'createdAt': createdAt,
      'readAt': null,
    };

void main() {
  final now = DateTime.utc(2026, 11, 9, 12);

  test('refresh follows cursors, keeps 90 days, and unread count updates',
      () async {
    final db = AppDatabase.memory();
    addTearDown(db.close);
    final t = _Transport({
      null: {
        'items': [_json('new', '2026-11-08T00:00:00Z')],
        'nextCursor': 'c1',
      },
      'c1': {
        'items': [
          _json('mid', '2026-09-20T00:00:00Z'),
          _json('old', '2026-06-01T00:00:00Z'),
        ],
        'nextCursor': 'c2',
      },
    });
    final repo = ApiInboxRepository(db, NotificationApi(t), clock: () => now);

    await repo.refresh();

    final items = await repo.watch().first;
    expect(items.map((i) => i.id), ['new', 'mid']);
    expect(items.first.data, {'k': 'v'});
    expect(await repo.unreadCount.first, 2);
    expect(t.calls, ['GET /v1/inbox', 'GET /v1/inbox?cursor=c1']);

    await repo.markRead(['new']);
    expect(await repo.unreadCount.first, 1);
    expect(t.calls.last, 'POST /v1/inbox/read');

    await repo.clear();
    expect(await repo.watch().first, isEmpty);
    expect(t.calls.last, 'DELETE /v1/inbox');
  });
}
