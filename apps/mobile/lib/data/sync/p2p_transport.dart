import 'dart:async';

/// A nearby device we may sync with.
class PeerInfo {
  final String id; // transport-level endpoint id
  final String name; // advertised name (the other device's node id)
  /// Short code both phones show, so the people holding them can confirm they are connecting to each other.
  final String authCode;
  const PeerInfo(this.id, this.name, this.authCode);
}

sealed class TransportEvent {
  const TransportEvent();
}

class PeerConnected extends TransportEvent {
  final String peerId;
  const PeerConnected(this.peerId);
}

class PeerMessage extends TransportEvent {
  final String peerId;
  final String text;
  const PeerMessage(this.peerId, this.text);
}

class PeerDisconnected extends TransportEvent {
  final String peerId;
  const PeerDisconnected(this.peerId);
}

/// Moves text messages between nearby devices. Swappable (Nearby Connections, Wi-Fi Direct, tests).
abstract class P2pTransport {
  Stream<TransportEvent> get events;

  /// Largest message [send] accepts, in UTF-8 bytes.
  int get maxMessageBytes;

  /// Advertise and look for peers. [approve] is asked before any connection is accepted; return false to refuse.
  Future<void> start(
    String deviceName,
    Future<bool> Function(PeerInfo peer) approve,
  );
  Future<void> send(String peerId, String text);
  Future<void> stop();
}
