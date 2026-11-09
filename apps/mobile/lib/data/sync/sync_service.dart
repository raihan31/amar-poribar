import '../api/api_client.dart';
import '../database/local_store.dart';

class SyncSummary {
  final int pushed;
  final int pulled;
  final List<String> rejectedReasons;
  const SyncSummary(this.pushed, this.pulled, this.rejectedReasons);
}

/// Syncs the local database with apps/api (SRS FR-SYNC-05). The server is one more replica: it gets our
/// new changes, we get what we have not downloaded yet, and per record the greater HLC wins on both sides.
class SyncService {
  final LocalStore store;
  final ApiClient api;
  SyncService(this.store, this.api);

  static const _pushedKey = 'server_pushed_seq';
  String _cursorKey(String familyId) => 'server_cursor:$familyId';

  /// Refresh the read-only copy of categories and accounts that entries refer to.
  Future<void> refreshReferenceData(String familyId) async {
    await store.replaceCategories(await api.categories(familyId));
    await store.replaceAccounts(await api.accounts(familyId));
  }

  /// Push local changes and pull remote ones until both sides are caught up.
  /// Throws [ApiException] when offline or rejected as a whole (for example a wrong device clock).
  Future<SyncSummary> sync(String familyId) async {
    var pushedSeq = int.parse(await store.getMeta(_pushedKey) ?? '0');
    var cursor = await store.getMeta(_cursorKey(familyId));
    var pushed = 0;
    var pulled = 0;
    final rejected = <String>[];

    // Bounded so a misbehaving server cannot keep us looping.
    for (var round = 0; round < 50; round++) {
      // Private entries go to the server too: it only ever returns them to their creator.
      final batch =
          await store.changesAfter(pushedSeq, includePrivate: true, limit: 200);
      final res = await api.sync(familyId, store.nodeId, cursor, batch.rows);
      pushed += batch.rows.length;
      rejected.addAll(res.rejected.map((r) => r.reason));
      pushedSeq = batch.lastSeq;

      // Anything we already had pushed does not need to go back to the server after we merge the reply.
      final nothingLeftToPush = !batch.more;
      pulled += await store.applyChanges(res.changes);
      if (nothingLeftToPush) pushedSeq = await store.currentSeq();

      cursor = res.cursor;
      await store.setMeta(_pushedKey, '$pushedSeq');
      await store.setMeta(_cursorKey(familyId), cursor);
      if (!res.more && !batch.more) break;
    }
    return SyncSummary(pushed, pulled, rejected);
  }
}
