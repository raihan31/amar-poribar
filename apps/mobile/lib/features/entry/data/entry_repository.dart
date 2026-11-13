import '../../../data/api/api_exception.dart';
import '../../../domain/models/api/draft.dart';
import '../domain/quick_parser.dart';

/// Where a sentence came from. The saved entry keeps it (FR-VOICE-02).
enum EntrySource {
  voice('voice'),
  text('ai_text'),
  sms('sms');

  const EntrySource(this.wire);
  final String wire;
}

/// The AI quota is used up (`ai_quota`). The screen shows the T-MOB-65 card.
class QuotaExceeded implements Exception {
  const QuotaExceeded();
}

/// There is no connection: the text was kept and will be understood later (T-MOB-49).
class QueuedOffline implements Exception {
  const QueuedOffline();
}

/// The server could not run the AI (`ai_unavailable`).
class AiUnavailable implements Exception {
  const AiUnavailable();
}

/// The part of the parser that needs the network: `POST /v1/families/:id/ai/parse`.
typedef RemoteParse = Future<List<TransactionDraft>> Function(String text);

/// Keeps a sentence for later when the phone is offline (FR-SYNC-03).
typedef QueueText = Future<void> Function(String text, String source);

/// Entries the AI understood while the phone was offline, waiting for a yes or no.
typedef ReadyDrafts = Future<List<TransactionDraft>> Function();

/// Removes a queued entry once it was saved or thrown away.
typedef DiscardPending = Future<void> Function(String pendingId);

abstract class EntryRepository {
  /// Turns a sentence into proposed entries. Throws [QuotaExceeded], [QueuedOffline] or
  /// [AiUnavailable]; never saves anything.
  Future<List<TransactionDraft>> parse(
    String text, {
    required EntrySource source,
  });

  Future<List<TransactionDraft>> readyDrafts();

  /// Takes [draft] out of the offline queue (T-MOB-49), if it came from there.
  Future<void> discard(TransactionDraft draft);
}

/// Tries the offline quick parser first and uses the network only when it is not sure
/// (NFR-14, FR-AI-13).
class ApiEntryRepository implements EntryRepository {
  ApiEntryRepository({
    required this.remote,
    required this.queue,
    this.ready,
    this.onDiscard,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  final RemoteParse remote;
  final QueueText queue;
  final ReadyDrafts? ready;
  final DiscardPending? onDiscard;
  final DateTime Function() _clock;

  @override
  Future<List<TransactionDraft>> parse(
    String text, {
    required EntrySource source,
  }) async {
    final quick = quickParse(text, _clock());
    if (quick != null) {
      return [quick.toDraft(source: source.wire, note: text.trim())];
    }
    try {
      final drafts = await remote(text);
      return [
        for (final d in drafts)
          source == EntrySource.voice ? d.copyWith(source: 'voice') : d,
      ];
    } on ApiException catch (e) {
      if (e.status == 0) {
        // A pasted SMS is never kept (T-MOB-30): the person pastes it again later.
        if (source != EntrySource.sms) await queue(text, source.wire);
        throw const QueuedOffline();
      }
      if (e.code == 'ai_quota') throw const QuotaExceeded();
      if (e.code == 'ai_unavailable') throw const AiUnavailable();
      rethrow;
    }
  }

  @override
  Future<List<TransactionDraft>> readyDrafts() async =>
      await ready?.call() ?? const [];

  @override
  Future<void> discard(TransactionDraft draft) async {
    final id = draft.pendingId;
    if (id != null) await onDiscard?.call(id);
  }
}
