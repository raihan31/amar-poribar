import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:nearby_connections/nearby_connections.dart';
import 'package:permission_handler/permission_handler.dart';

import 'p2p_transport.dart';

/// [P2pTransport] over Google Nearby Connections (Bluetooth / Wi-Fi, no internet needed).
///
/// Both phones advertise and discover. To avoid both dialling each other, only the phone whose name
/// sorts first sends the connection request. Nothing is accepted until the people holding the phones
/// confirm the short code shown on both screens ([approve]).
class NearbyTransport implements P2pTransport {
  static const _serviceId = 'com.amar.poribar.sync';
  static const _strategy = Strategy.P2P_CLUSTER;

  final Nearby _nearby = Nearby();
  final _events = StreamController<TransportEvent>.broadcast();
  final _connected = <String>{};
  String _name = '';
  Future<bool> Function(PeerInfo peer)? _approve;

  @override
  Stream<TransportEvent> get events => _events.stream;

  /// Nearby's byte payloads are limited to 32 KB; leave room for framing.
  @override
  int get maxMessageBytes => 30000;

  /// Runtime permissions Nearby needs (Android 12+ Bluetooth and Android 13+ Wi-Fi devices, plus location on older).
  static Future<bool> ensurePermissions() async {
    final results = await [
      Permission.location,
      Permission.bluetoothScan,
      Permission.bluetoothAdvertise,
      Permission.bluetoothConnect,
      Permission.nearbyWifiDevices,
    ].request();
    // Permissions that don't exist on the running Android version report as granted or restricted.
    return results.values
        .every((s) => s.isGranted || s.isLimited || s.isRestricted);
  }

  @override
  Future<void> start(
    String deviceName,
    Future<bool> Function(PeerInfo peer) approve,
  ) async {
    _name = deviceName;
    _approve = approve;
    if (!await ensurePermissions()) {
      throw StateError('Nearby permissions were not granted');
    }
    await _nearby.startAdvertising(
      deviceName,
      _strategy,
      serviceId: _serviceId,
      onConnectionInitiated: _onInitiated,
      onConnectionResult: _onResult,
      onDisconnected: _onDisconnected,
    );
    await _nearby.startDiscovery(
      deviceName,
      _strategy,
      serviceId: _serviceId,
      onEndpointFound: (id, name, service) {
        if (_connected.contains(id)) return;
        if (_name.compareTo(name) < 0) {
          _nearby.requestConnection(
            _name,
            id,
            onConnectionInitiated: _onInitiated,
            onConnectionResult: _onResult,
            onDisconnected: _onDisconnected,
          );
        }
      },
      onEndpointLost: (_) {},
    );
  }

  Future<void> _onInitiated(String id, ConnectionInfo info) async {
    final ok = await (_approve
            ?.call(PeerInfo(id, info.endpointName, info.authenticationToken)) ??
        Future.value(false));
    if (!ok) {
      await _nearby.rejectConnection(id);
      return;
    }
    await _nearby.acceptConnection(
      id,
      onPayLoadRecieved: (endpointId, payload) {
        final bytes = payload.bytes;
        if (payload.type == PayloadType.BYTES && bytes != null) {
          _events.add(PeerMessage(endpointId, utf8.decode(bytes)));
        }
      },
    );
  }

  void _onResult(String id, Status status) {
    if (status == Status.CONNECTED) {
      _connected.add(id);
      _events.add(PeerConnected(id));
    }
  }

  void _onDisconnected(String id) {
    _connected.remove(id);
    _events.add(PeerDisconnected(id));
  }

  @override
  Future<void> send(String peerId, String text) =>
      _nearby.sendBytesPayload(peerId, Uint8List.fromList(utf8.encode(text)));

  @override
  Future<void> stop() async {
    await _nearby.stopAdvertising();
    await _nearby.stopDiscovery();
    await _nearby.stopAllEndpoints();
    _connected.clear();
  }
}
