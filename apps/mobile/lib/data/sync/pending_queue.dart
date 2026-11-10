import 'dart:convert';

import '../api/api_client.dart';
import '../database/local_store.dart';

/// Runs the AI parse for text captured while offline, once the phone can reach the server (FR-SYNC-03).
/// Results are never saved on their own: each proposed entry waits for the user to confirm it (FR-AI-05).
class PendingQueue {
  final LocalStore store;
  final ApiClient api;
  PendingQueue(this.store, this.api);

  /// Parse queued texts, oldest first. Returns how many were handled.
  ///
  /// Stops quietly while offline, so the rest stays queued. A 401 is rethrown so the app can sign in
  /// again. Other server refusals (AI quota used up, AI unavailable) mark just that item as failed with
  /// the reason, so the user can enter it by hand.
  Future<int> process(String familyId) async {
    var handled = 0;
    for (final item in await store.pending()) {
      if (item.status != 'queued') continue;
      try {
        final drafts = await api.parse(familyId, item.rawText);
        await store.markParsed(item.id, [
          for (final d in drafts)
            (item.source == 'voice' ? d.copyWith(source: 'voice') : d).toJson(),
        ]);
        handled++;
      } on ApiException catch (e) {
        if (e.status == 0) break; // still offline
        if (e.isUnauthorized) rethrow;
        await store.markFailed(item.id, e.message);
        handled++;
      }
    }
    return handled;
  }

  /// Ready drafts waiting for confirmation, each tied to its queue row.
  Future<List<TransactionDraft>> readyDrafts() async => [
        for (final p in await store.pending())
          if (p.status == 'ready' && p.draftJson != null)
            TransactionDraft.fromJson(
              jsonDecode(p.draftJson!) as Map<String, dynamic>,
            ).withPendingId(p.id),
      ];
}
