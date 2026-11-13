import 'push_service.dart';

/// Maps a push `data.type` to an app route (T-MOB-34), or null when it cannot be opened.
String? routeFor(PushMessage m) {
  final d = m.data;
  String? need(String? v) => (v == null || v.isEmpty) ? null : v;
  switch (m.type) {
    case 'nudge':
      final id = need(d['id']);
      return id == null ? null : '/buzz/incoming/$id';
    case 'msg':
      final c = need(d['conversationId']);
      return c == null ? null : '/talk/$c';
    case 'budget':
      return '/budget';
    case 'reminder':
      return '/notifications';
    case 'call':
      final id = need(d['callId']) ?? need(d['id']);
      return id == null ? null : '/call/$id';
    case 'invite':
      final id = need(d['id']);
      return id == null ? null : '/join/$id';
  }
  return null;
}

/// Sends a tapped notification to the router (`deepLinkProvider`).
class PushRouter {
  PushRouter(this.go);

  final void Function(String location) go;

  void open(PushMessage m) {
    final r = routeFor(m);
    if (r != null) go(r);
  }
}
