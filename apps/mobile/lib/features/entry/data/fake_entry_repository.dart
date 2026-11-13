import '../../../data/api/api_exception.dart';
import '../../../domain/models/api/draft.dart';
import 'entry_repository.dart';

/// In-memory entry repository for tests. It runs the real quick-parser-first logic of
/// [ApiEntryRepository] over a scripted "network", and counts how often that network was used.
class FakeEntryRepository extends ApiEntryRepository {
  FakeEntryRepository({
    RemoteParse? remote,
    this.offline = false,
    this.quota = false,
    DateTime? now,
  })  : _script = remote,
        super(
          remote: _unused,
          queue: _unusedQueue,
          clock: () => now ?? DateTime.utc(2026, 11, 9, 4),
        );

  static Future<List<TransactionDraft>> _unused(String text) async => const [];
  static Future<void> _unusedQueue(String text, String source) async {}

  final bool offline;
  final bool quota;

  /// How many times the pretend network was called.
  int apiCalls = 0;

  /// Texts kept for later while offline.
  final List<String> queued = [];

  final RemoteParse? _script;

  @override
  RemoteParse get remote => (text) async {
        apiCalls++;
        if (offline) throw ApiException(0, 'offline');
        if (quota) throw ApiException(429, 'quota', code: 'ai_quota');
        return await _script?.call(text) ?? const <TransactionDraft>[];
      };

  @override
  QueueText get queue => (text, source) async => queued.add(text);
}
