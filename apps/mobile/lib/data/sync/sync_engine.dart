import 'dart:convert';
import 'package:sqlite_crdt/sqlite_crdt.dart';
import 'p2p_network_adapter.dart';

class SyncEngine {
  final SqlCrdt crdtDb;
  final P2pNetworkAdapter networkAdapter;
  final String localDeviceId;

  SyncEngine({
    required this.crdtDb,
    required this.networkAdapter,
    required this.localDeviceId,
  }) {
    _initializeNetworkListeners();
  }

  void _initializeNetworkListeners() {
    networkAdapter.onConnectionEstablished.listen((peerId) {
      // Step 1: When connected, request peer's HLC. We also send ours.
      _initiateSync(peerId);
    });

    networkAdapter.onPayloadReceived.listen((payload) async {
      await _handleIncomingPayload(payload.peerId, payload.data);
    });
  }

  Future<void> _initiateSync(String peerId) async {
    // Determine the last exact sync time we had with this peer, or from the beginning
    // (In reality, we'd store a high-water mark for each peer in a local table).
    // For now, we request all data modified by *them* or others, since a timestamp.
    final localHlc = crdtDb.canonicalTime;
    
    final message = {
      'type': 'SYNC_REQUEST',
      'local_hlc': localHlc.toString(),
    };
    
    await networkAdapter.sendMessage(peerId, jsonEncode(message));
  }

  Future<void> _handleIncomingPayload(String peerId, String rawData) async {
    // Payload should be decrypted by the network adapter before this point.
    final Map<String, dynamic> data = jsonDecode(rawData);

    final type = data['type'];

    if (type == 'SYNC_REQUEST') {
      final peerHlc = data['local_hlc'];
      // They requested a sync since peerHlc. We gather our local changes (deltas)
      final deltas = await crdtDb.getChangeset(customNodeId: localDeviceId); 
      // note: crdtDb.getChangeset() natively returns Map<String, List<Map<String,dynamic>>>
      
      final response = {
        'type': 'SYNC_DELTA',
        'deltas': deltas,
      };
      
      await networkAdapter.sendMessage(peerId, jsonEncode(response));
    } 
    else if (type == 'SYNC_DELTA') {
      final deltas = data['deltas'] as Map<String, dynamic>;
      
      // Step 3: Apply the changeset locally. CRDT LWW takes effect here!
      // Any conflicts are resolved mathematically using HLC.
      await crdtDb.merge(deltas.cast<String, List<Map<String, Object?>>>());
      
      print('Successfully synchronized with peer: $peerId');
      
      // Optionally fire a UI refresh event.
    }
  }

  void startAdvertising() {
    networkAdapter.startAdvertising(localDeviceId);
  }

  void startDiscovering() {
    networkAdapter.startDiscovering();
  }

  void stop() {
    networkAdapter.stopAll();
  }
}
