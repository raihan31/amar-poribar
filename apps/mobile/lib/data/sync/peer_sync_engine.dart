import 'dart:async';
import 'dart:convert';

import '../database/local_store.dart';
import 'hlc.dart';
import 'p2p_transport.dart';

/// Device-to-device sync (SRS FR-SYNC-04). Over any [P2pTransport] it speaks a small protocol:
///
///   hello  {node, family}                      on connect, both ways
///   pull   {after}                             "send me your changes after position N of your log"
///   push   {rows, lastSeq, more}               the answer; the receiver merges and, if `more`, pulls again
///
/// Merging is the same per-record greater-HLC rule used with the server, so a change reaches a device the
/// same way whether it came from a nearby phone or from the server.
class PeerSyncEngine {
  final LocalStore store;
  final P2pTransport transport;
  final String familyId;
  final void Function(String message)? onStatus;
  final Future<bool> Function(PeerInfo peer) approve;

  PeerSyncEngine({
    required this.store,
    required this.transport,
    required this.familyId,
    required this.approve,
    this.onStatus,
  });

  StreamSubscription<TransportEvent>? _sub;
  final _peerNodes =
      <String, String>{}; // transport id -> node id (after hello)
  final _dropped = <String>{}; // peers from another family

  Future<void> start() async {
    _sub = transport.events.listen((e) => unawaited(_onEvent(e)));
    await transport.start(store.nodeId, approve);
    onStatus?.call('Looking for nearby family devices…');
  }

  Future<void> stop() async {
    await _sub?.cancel();
    _sub = null;
    await transport.stop();
    _peerNodes.clear();
  }

  /// Ask every connected peer for anything new (call after saving an entry).
  Future<void> syncNow() async {
    for (final entry in _peerNodes.entries) {
      await _pull(entry.key, entry.value);
    }
  }

  Future<void> _onEvent(TransportEvent e) async {
    switch (e) {
      case PeerConnected(:final peerId):
        await _send(
          peerId,
          {'t': 'hello', 'node': store.nodeId, 'family': familyId},
        );
      case PeerDisconnected(:final peerId):
        _peerNodes.remove(peerId);
        _dropped.remove(peerId);
      case PeerMessage(:final peerId, :final text):
        try {
          await _onMessage(peerId, jsonDecode(text) as Map<String, dynamic>);
        } on ClockDriftException {
          onStatus?.call(
            "A nearby phone's date and time are wrong, so its changes were not accepted.",
          );
        } catch (_) {
          // A malformed message from a peer must not stop syncing with others.
        }
    }
  }

  Future<void> _onMessage(String peerId, Map<String, dynamic> m) async {
    if (_dropped.contains(peerId)) return;
    switch (m['t']) {
      case 'hello':
        if (m['family'] != familyId) {
          _dropped.add(peerId); // another family's device: never exchange data
          onStatus?.call('Ignored a device from a different family.');
          return;
        }
        final node = m['node'] as String;
        _peerNodes[peerId] = node;
        await _pull(peerId, node);
      case 'pull':
        if (!_peerNodes.containsKey(peerId)) {
          return; // no data before a valid hello
        }
        await _answerPull(peerId, (m['after'] as num).toInt());
      case 'push':
        final node = _peerNodes[peerId];
        if (node == null) return;
        final rows = [
          for (final r in m['rows'] as List)
            Map<String, dynamic>.from(r as Map),
        ];
        final changed = await store.applyChanges(rows);
        // Only move the cursor once the rows are safely merged.
        await store.setMeta(
          _cursorKey(node),
          '${(m['lastSeq'] as num).toInt()}',
        );
        if (changed > 0) {
          onStatus?.call('Received $changed change(s) from a nearby phone.');
        }
        if (m['more'] == true) await _pull(peerId, node);
    }
  }

  String _cursorKey(String node) => 'peer_cursor:$familyId:$node';

  Future<void> _pull(String peerId, String node) async {
    final after = int.parse(await store.getMeta(_cursorKey(node)) ?? '0');
    await _send(peerId, {'t': 'pull', 'after': after});
  }

  Future<void> _answerPull(String peerId, int after) async {
    // Private entries never go to other devices, only to the server (where they stay with their creator).
    var limit = 40;
    while (true) {
      final batch = await store.changesAfter(after, limit: limit);
      final msg = jsonEncode({
        't': 'push',
        'rows': batch.rows,
        'lastSeq': batch.lastSeq,
        'more': batch.more,
      });
      if (utf8.encode(msg).length <= transport.maxMessageBytes) {
        await transport.send(peerId, msg);
        return;
      }
      if (limit == 1) {
        return; // a single row too large to send: skip rather than loop
      }
      limit = (limit / 2).ceil();
    }
  }

  Future<void> _send(String peerId, Map<String, dynamic> m) =>
      transport.send(peerId, jsonEncode(m));
}
