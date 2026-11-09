import 'package:flutter_test/flutter_test.dart';

import 'package:amar_poribar/data/api/api_client.dart';
import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:amar_poribar/data/sync/pending_queue.dart';

TransactionDraft draft(int paisa, {String note = 'n'}) => TransactionDraft(
      type: 'expense',
      amountPaisa: paisa,
      feePaisa: 0,
      occurredAt: '2026-11-09T10:00:00.000Z',
      categoryKey: 'bazaar',
      accountType: null,
      note: note,
      counterparty: null,
      trxId: null,
      source: 'ai_text',
      confidence: 0.9,
    );

/// Parse results (or errors) scripted per input text.
class ScriptedApi extends ApiClient {
  ScriptedApi(this.script) : super(baseUrl: 'http://fake');
  final Map<String, Object>
      script; // text -> List<TransactionDraft> | ApiException
  final seen = <String>[];

  @override
  Future<List<TransactionDraft>> parse(String familyId, String text,
      {DateTime? now}) async {
    seen.add(text);
    final r = script[text];
    if (r is ApiException) throw r;
    return r! as List<TransactionDraft>;
  }
}

Future<LocalStore> store() => LocalStore.open(AppDatabase.memory(),
    now: () => DateTime.utc(2026, 11, 9, 10));

void main() {
  test(
      'texts typed offline are parsed later, oldest first, and wait for confirmation',
      () async {
    final s = await store();
    await s.queueText('first');
    await s.queueText('second', source: 'voice');
    final api = ScriptedApi({
      'first': [draft(85000)],
      'second': [draft(1000), draft(2000)],
    });
    final handled = await PendingQueue(s, api).process('f1');
    expect(handled, 2);
    expect(api.seen, ['first', 'second']);

    final ready = await PendingQueue(s, api).readyDrafts();
    expect(ready.map((d) => d.amountPaisa), [85000, 1000, 2000]);
    expect(ready.every((d) => d.pendingId != null), isTrue);
    expect(ready[1].source, 'voice',
        reason: 'a spoken entry stays marked as voice');
    // Nothing was saved as a real transaction yet.
    expect((await s.changesAfter(0, includePrivate: true)).rows, isEmpty);
  });

  test('still offline: stays queued and nothing is lost', () async {
    final s = await store();
    await s.queueText('later');
    final api = ScriptedApi({'later': ApiException(0, 'offline')});
    expect(await PendingQueue(s, api).process('f1'), 0);
    final p = await s.pending();
    expect(p.single.status, 'queued');
  });

  test('offline in the middle keeps the rest queued in order', () async {
    final s = await store();
    await s.queueText('a');
    await s.queueText('b');
    await s.queueText('c');
    final api = ScriptedApi({
      'a': [draft(1)],
      'b': ApiException(0, 'offline'),
      'c': [draft(3)],
    });
    await PendingQueue(s, api).process('f1');
    expect(api.seen, ['a', 'b'],
        reason: 'it stops at the first offline failure');
    expect((await s.pending()).map((p) => '${p.rawText}:${p.status}'),
        ['a:ready', 'b:queued', 'c:queued']);
  });

  test('quota used up marks only that item failed, with the reason', () async {
    final s = await store();
    await s.queueText('over');
    await s.queueText('fine');
    final api = ScriptedApi({
      'over': ApiException(429, "This month's AI limit has been reached"),
      'fine': [draft(5)],
    });
    expect(await PendingQueue(s, api).process('f1'), 2);
    final p = {for (final x in await s.pending()) x.rawText: x};
    expect(p['over']!.status, 'failed');
    expect(p['over']!.error, contains('limit'));
    expect(p['fine']!.status, 'ready');
  });

  test('an expired sign-in is rethrown and the item stays queued', () async {
    final s = await store();
    await s.queueText('x');
    final api =
        ScriptedApi({'x': ApiException(401, 'Missing or invalid token')});
    await expectLater(
        PendingQueue(s, api).process('f1'), throwsA(isA<ApiException>()));
    expect((await s.pending()).single.status, 'queued');
  });

  test('a text the AI could not read leaves nothing to confirm', () async {
    final s = await store();
    await s.queueText('hello');
    await PendingQueue(s, ScriptedApi({'hello': <TransactionDraft>[]}))
        .process('f1');
    expect(await s.pending(), isEmpty);
  });

  test(
      'confirming a ready draft removes it from the queue; processing twice does not duplicate',
      () async {
    final s = await store();
    await s.queueText('once');
    final q = PendingQueue(
        s,
        ScriptedApi({
          'once': [draft(7)]
        }));
    await q.process('f1');
    await q.process('f1');
    final ready = await q.readyDrafts();
    expect(ready, hasLength(1));
    await s.deletePending(ready.single.pendingId!);
    expect(await q.readyDrafts(), isEmpty);
  });
}
