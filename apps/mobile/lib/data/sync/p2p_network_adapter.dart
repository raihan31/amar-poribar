import 'dart:async';

class NetworkPayload {
  final String peerId;
  final String data;

  NetworkPayload(this.peerId, this.data);
}

// Abstract Adapter to allow swapping Nearby Connections with Wifi Direct or raw WebSockets
abstract class P2pNetworkAdapter {
  Stream<String> get onConnectionEstablished;
  Stream<NetworkPayload> get onPayloadReceived;
  Stream<String> get onConnectionLost;

  Future<void> startAdvertising(String localDeviceId);
  Future<void> startDiscovering();
  
  Future<void> requestConnection(String endpointId);
  Future<void> acceptConnection(String endpointId);
  
  Future<void> sendMessage(String endpointId, String payload);
  
  void stopAll();
}

// Mock implementation using Google's Nearby Connections
class NearbyConnectionsAdapter implements P2pNetworkAdapter {
  final _connectionEstablishedController = StreamController<String>.broadcast();
  final _payloadReceivedController = StreamController<NetworkPayload>.broadcast();
  final _connectionLostController = StreamController<String>.broadcast();

  @override
  Stream<String> get onConnectionEstablished => _connectionEstablishedController.stream;

  @override
  Stream<NetworkPayload> get onPayloadReceived => _payloadReceivedController.stream;

  @override
  Stream<String> get onConnectionLost => _connectionLostController.stream;

  final String serviceId = 'com.amar.poribar.sync';

  @override
  Future<void> startAdvertising(String localDeviceId) async {
    // Strategy: P2P_STAR or P2P_CLUSTER. 
    // This utilizes Wifi aware + Bluetooth.
    print('Started Advertising as $localDeviceId');
  }

  @override
  Future<void> startDiscovering() async {
    print('Started Discovering nearby peers on $serviceId');
  }

  @override
  Future<void> requestConnection(String endpointId) async {
    print('Requesting connection to $endpointId');
  }

  @override
  Future<void> acceptConnection(String endpointId) async {
    print('Accepted connection from $endpointId');
    _connectionEstablishedController.add(endpointId);
  }

  @override
  Future<void> sendMessage(String endpointId, String payload) async {
    print('Sending encrypted payload to $endpointId');
    // Encryption layer wrapper would go here: ChaCha20-Poly1305.
  }

  @override
  void stopAll() {
    print('Stopping all P2P connections');
  }
}
