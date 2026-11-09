/// Hybrid logical clock (SRS FR-SYNC-02). Written as a fixed-width string so that plain string
/// comparison orders events: time, then counter, then node id (the tie-break).
///
///   2026-11-09T10:00:00.000Z-000A-node-1
///
/// The same format and rules are implemented in apps/api (src/hlc.ts) and checked against
/// shared test vectors (packages/shared/test-vectors/hlc.json).
class Hlc implements Comparable<Hlc> {
  final DateTime time; // UTC, millisecond precision
  final int counter;
  final String nodeId;

  Hlc(DateTime time, this.counter, this.nodeId) : time = time.toUtc();

  /// A node's initial clock value.
  factory Hlc.zero(String nodeId) =>
      Hlc(DateTime.fromMillisecondsSinceEpoch(0, isUtc: true), 0, nodeId);

  static const int maxCounter = 0xFFFF;

  /// Remote clocks further ahead than this are rejected, so one wrong phone clock cannot win every merge.
  static const Duration maxDrift = Duration(hours: 24);

  factory Hlc.parse(String s) {
    // 24 chars of ISO time, '-', 4 hex digits, '-', node id.
    if (s.length < 30 || s[24] != '-' || s[29] != '-') {
      throw FormatException('Not an HLC: $s');
    }
    final time = DateTime.parse(s.substring(0, 24));
    final counter = int.parse(s.substring(25, 29), radix: 16);
    return Hlc(time, counter, s.substring(30));
  }

  @override
  String toString() =>
      '${time.toIso8601String()}-${counter.toRadixString(16).toUpperCase().padLeft(4, '0')}-$nodeId';

  /// Clock value for a local event (create, edit, delete).
  Hlc send(DateTime now) {
    final wall = DateTime.fromMillisecondsSinceEpoch(now.millisecondsSinceEpoch,
        isUtc: true);
    if (wall.isAfter(time)) return Hlc(wall, 0, nodeId);
    if (counter >= maxCounter)
      return Hlc(time.add(const Duration(milliseconds: 1)), 0, nodeId);
    return Hlc(time, counter + 1, nodeId);
  }

  /// Clock value after seeing [remote], so later local events sort after it.
  Hlc receive(Hlc remote, DateTime now) {
    final wall = DateTime.fromMillisecondsSinceEpoch(now.millisecondsSinceEpoch,
        isUtc: true);
    if (remote.time.isAfter(wall.add(maxDrift))) {
      throw ClockDriftException(remote);
    }
    var t = time;
    var c = counter;
    if (remote.time.isAfter(t) || (remote.time == t && remote.counter > c)) {
      t = remote.time;
      c = remote.counter;
    }
    if (wall.isAfter(t)) return Hlc(wall, 0, nodeId);
    return c >= maxCounter
        ? Hlc(t.add(const Duration(milliseconds: 1)), 0, nodeId)
        : Hlc(t, c + 1, nodeId);
  }

  @override
  int compareTo(Hlc other) => toString().compareTo(other.toString());

  @override
  bool operator ==(Object other) =>
      other is Hlc && other.toString() == toString();

  @override
  int get hashCode => toString().hashCode;
}

class ClockDriftException implements Exception {
  final Hlc remote;
  ClockDriftException(this.remote);

  @override
  String toString() => 'Remote clock is too far ahead: $remote';
}
