import 'package:amar_poribar/core/push/push_router.dart';
import 'package:amar_poribar/core/push/push_service.dart';
import 'package:flutter_test/flutter_test.dart';

PushMessage msg(String type, Map<String, String> extra) =>
    PushMessage({'type': type, 'familyId': 'f1', ...extra});

void main() {
  test('each type maps to its route', () {
    expect(routeFor(msg('nudge', {'id': 'n1'})), '/buzz/incoming/n1');
    expect(
      routeFor(msg('msg', {'conversationId': 'c9', 'id': 'm1'})),
      '/talk/c9',
    );
    expect(routeFor(msg('budget', {})), '/budget');
    expect(routeFor(msg('reminder', {})), '/notifications');
    expect(routeFor(msg('call', {'callId': 'k3'})), '/call/k3');
    expect(routeFor(msg('invite', {'id': 'tok'})), '/join/tok');
  });

  test('call falls back to id; unknown types and missing ids give null', () {
    expect(routeFor(msg('call', {'id': 'k4'})), '/call/k4');
    expect(routeFor(msg('nudge', {})), isNull);
    expect(routeFor(msg('weird', {'id': '1'})), isNull);
  });

  test('open() hands the route to the router', () {
    final seen = <String>[];
    PushRouter(seen.add).open(msg('budget', {}));
    PushRouter(seen.add).open(msg('weird', {}));
    expect(seen, ['/budget']);
  });
}
