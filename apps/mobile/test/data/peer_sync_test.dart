import 'dart:async';

import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:amar_poribar/data/sync/p2p_transport.dart';
import 'package:amar_poribar/data/sync/peer_sync_engine.dart';
import 'package:flutter_test/flutter_test.dart';

/// Two phones joined by an in-memory link.
class MemoryTransport implements P2pTransport {
  MemoryTransport(this.maxBytes);
  final int maxBytes;
  MemoryTransport? other;
  final _events = StreamController<TransportEvent>.broadcast();
  final sent = <String>[];
  bool started = false;

  @override
  Stream<TransportEvent> get events => _events.stream;
  @override
  int get maxMessageBytes => maxBytes;
  @override
  Future<void> start(
    String deviceName,
    Future<bool> Function(PeerInfo peer) approve,
  ) async =>
      started = true;
  @override
  Future<void> send(String peerId, String text) async {
    expect(
      text.length,
      lessThanOrEqualTo(maxBytes),
      reason: 'every message must fit the transport limit',
    );
    sent.add(text);
    scheduleMicrotask(() => other!._events.add(PeerMessage('link', text)));
  }

  @override
  Future<void> stop() async => started = false;

  void connect() => _events.add(const PeerConnected('link'));
  void disconnect() => _events.add(const PeerDisconnected('link'));
}

class Phone {
  Phone(this.store, this.transport, this.engine);
  final LocalStore store;
  final MemoryTransport transport;
  final PeerSyncEngine engine;
  final status = <String>[];
}

Future<Phone> phone(
  String family, {
  int maxBytes = 30000,
  DateTime? now,
}) async {
  final store = await LocalStore.open(
    AppDatabase.memory(),
    now: () => now ?? DateTime.utc(2026, 11, 9, 10),
  );
  final t = MemoryTransport(maxBytes);
  late Phone p;
  final engine = PeerSyncEngine(
    store: store,
    transport: t,
    familyId: family,
    approve: (_) async => true,
    onStatus: (m) => p.status.add(m),
  );
  p = Phone(store, t, engine);
  await engine.start();
  return p;
}

Future<void> link(Phone a, Phone b) async {
  a.transport.other = b.transport;
  b.transport.other = a.transport;
  a.transport.connect();
  b.transport.connect();
  await pumpEventQueue(times: 400);
}

Future<Set<String>> ids(LocalStore s) async => {
      for (final r in (await s.changesAfter(0, includePrivate: true)).rows)
        r['id'] as String,
    };

void main() {
  test('two phones with no internet end up with each other\'s entries',
      () async {
    final a = await phone('fam');
    final b = await phone('fam');
    await a.store.addTransaction(id: 'a1', type: 'expense', amountPaisa: 100);
    await b.store.addTransaction(id: 'b1', type: 'income', amountPaisa: 200);
    await link(a, b);
    expect(await ids(a.store), {'a1', 'b1'});
    expect(await ids(b.store), {'a1', 'b1'});
  });

  test('works with a tiny message limit by sending in pieces', () async {
    final a = await phone('fam', maxBytes: 1200);
    final b = await phone('fam', maxBytes: 1200);
    for (var i = 0; i < 25; i++) {
      await a.store.addTransaction(
        id: 'a$i',
        type: 'expense',
        amountPaisa: i + 1,
        note: 'বাজার $i',
      );
    }
    await link(a, b);
    expect((await ids(b.store)).length, 25);
    expect(
      a.transport.sent.length,
      greaterThan(3),
      reason: 'rows were split over several messages',
    );
  });

  test('a delete made on one phone reaches the other', () async {
    final a = await phone('fam');
    final b = await phone('fam');
    await a.store.addTransaction(id: 'x', type: 'expense', amountPaisa: 1);
    await link(a, b);
    await b.store.deleteTransaction('x');
    b.transport.disconnect();
    a.transport.disconnect();
    await pumpEventQueue(times: 50);
    await link(a, b);
    expect(await a.store.recent(), isEmpty);
  });

  test('private entries stay on the phone', () async {
    final a = await phone('fam');
    final b = await phone('fam');
    await a.store.addTransaction(
      id: 'secret',
      type: 'expense',
      amountPaisa: 1,
      isPrivate: true,
    );
    await a.store.addTransaction(id: 'shared', type: 'expense', amountPaisa: 1);
    await link(a, b);
    expect(await ids(b.store), {'shared'});
  });

  test('a device from another family is ignored', () async {
    final a = await phone('fam-1');
    final b = await phone('fam-2');
    await a.store.addTransaction(id: 'a1', type: 'expense', amountPaisa: 1);
    await b.store.addTransaction(id: 'b1', type: 'expense', amountPaisa: 1);
    await link(a, b);
    expect(await ids(a.store), {'a1'});
    expect(await ids(b.store), {'b1'});
    expect(a.status.any((s) => s.contains('different family')), isTrue);
  });

  test('reconnecting only sends what is new', () async {
    final a = await phone('fam');
    final b = await phone('fam');
    for (var i = 0; i < 5; i++) {
      await a.store.addTransaction(id: 'a$i', type: 'expense', amountPaisa: 1);
    }
    await link(a, b);
    a.transport.sent.clear();
    a.transport.disconnect();
    b.transport.disconnect();
    await pumpEventQueue(times: 50);
    await a.store.addTransaction(id: 'later', type: 'expense', amountPaisa: 1);
    await link(a, b);
    final pushes =
        a.transport.sent.where((m) => m.contains('"t":"push"')).toList();
    expect(pushes, isNotEmpty);
    expect(
      pushes.join().contains('"a0"'),
      isFalse,
      reason: 'old entries are not sent again',
    );
    expect((await ids(b.store)).contains('later'), isTrue);
  });

  test('a peer with a clock far in the future is refused without breaking sync',
      () async {
    final a = await phone('fam');
    final b = await phone('fam', now: DateTime.utc(2030, 1, 1));
    await a.store.addTransaction(id: 'ok', type: 'expense', amountPaisa: 1);
    await b.store.addTransaction(id: 'future', type: 'expense', amountPaisa: 1);
    await link(a, b);
    expect(
      await ids(a.store),
      {'ok'},
      reason: "the future-dated phone's entry is not merged",
    );
    expect(a.status.any((s) => s.contains('date and time')), isTrue);
  });

  test('data before a valid hello is ignored', () async {
    final a = await phone('fam');
    a.transport.other = MemoryTransport(30000);
    a.transport._events.add(
      const PeerMessage(
        'stranger',
        '{"t":"push","rows":[{"id":"evil","hlc":"2026-11-09T10:00:00.000Z-0000-x"}],"lastSeq":1,"more":false}',
      ),
    );
    await pumpEventQueue(times: 50);
    expect(await ids(a.store), isEmpty);
  });

  test('garbage from a peer does not crash the engine', () async {
    final a = await phone('fam');
    a.transport._events.add(const PeerMessage('p', 'not json'));
    a.transport._events.add(const PeerMessage('p', '{"t":"hello"}'));
    await pumpEventQueue(times: 50);
    await a.store
        .addTransaction(id: 'still-works', type: 'expense', amountPaisa: 1);
    expect(await ids(a.store), {'still-works'});
  });
}
