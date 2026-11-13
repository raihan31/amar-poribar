import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/speech/bangla_words.dart';
import '../../../core/speech/categories.dart';
import '../../../data/api/api_exception.dart';
import '../../../domain/models/api/draft.dart';
import '../../../presentation/providers/auth_provider.dart';
import '../../../presentation/providers/providers.dart';
import '../../budgets/state/budget_providers.dart';
import '../../family/state/family_providers.dart';
import '../../transactions/state/add_expense_controller.dart';
import '../../voice/state/voice_capability_provider.dart';
import '../data/entry_repository.dart';

/// The real repository; tests override it with `FakeEntryRepository`.
final entryRepositoryProvider = Provider<EntryRepository>((ref) {
  final store = ref.watch(localStoreProvider);
  return ApiEntryRepository(
    remote: (text) async {
      final family = await ref.read(currentFamilyProvider.future);
      return ref.read(apiClientProvider).parse(family.id, text);
    },
    queue: (text, source) async {
      await store.queueText(text, source: source);
    },
    ready: () async {
      final family = await ref.read(currentFamilyProvider.future);
      final queue = ref.read(pendingQueueProvider);
      try {
        await queue.process(family.id);
      } on ApiException {
        // Offline or signed out: show whatever is already understood.
      }
      return queue.readyDrafts();
    },
    onDiscard: store.deletePending,
  );
});

/// Where "now" comes from; tests override it with a `FakeClock`.
final entryClockProvider = Provider<DateTime Function()>((_) => DateTime.now);

/// Runs after an entry is saved: quiet sync, then spoken budget alerts (FR-BUD-02). Tests
/// override it with a no-op.
final entryAfterSaveProvider = Provider<Future<void> Function()>((ref) {
  return () async {
    try {
      final family = await ref.read(currentFamilyProvider.future);
      await ref.read(syncServiceProvider).sync(family.id);
      await _speakBudgetAlerts(ref);
    } catch (_) {
      // Offline is fine: the next sync catches up.
    }
  };
});

Future<void> _speakBudgetAlerts(Ref ref) =>
    ref.read(spokenAlertControllerProvider).check();

enum EntryPhase { idle, listening, parsing, drafts, saving }

/// What A3 shows. Phases run `idle -> listening -> parsing -> drafts -> saving`.
class EntryState {
  const EntryState({
    this.phase = EntryPhase.idle,
    this.transcript = '',
    this.drafts = const [],
    this.quotaExceeded = false,
    this.queuedOffline = false,
    this.problem = false,
    this.micError,
    this.heardAt,
    this.readBackAt,
  });

  final EntryPhase phase;

  /// What the person said, shown under "আপনি বললেন:".
  final String transcript;
  final List<TransactionDraft> drafts;

  /// `ai_quota`: the quota card replaces the cards (T-MOB-65).
  final bool quotaExceeded;

  /// No connection: the text is kept and understood later (T-MOB-49).
  final bool queuedOffline;

  /// Nothing could be understood, or the AI is unavailable.
  final bool problem;
  final String? micError;

  /// When the final transcript arrived and when the read-back started (NFR-14).
  final DateTime? heardAt;
  final DateTime? readBackAt;

  EntryState copyWith({
    EntryPhase? phase,
    String? transcript,
    List<TransactionDraft>? drafts,
    bool? quotaExceeded,
    bool? queuedOffline,
    bool? problem,
    Object? micError = _keep,
    DateTime? heardAt,
    DateTime? readBackAt,
  }) =>
      EntryState(
        phase: phase ?? this.phase,
        transcript: transcript ?? this.transcript,
        drafts: drafts ?? this.drafts,
        quotaExceeded: quotaExceeded ?? this.quotaExceeded,
        queuedOffline: queuedOffline ?? this.queuedOffline,
        problem: problem ?? this.problem,
        micError:
            identical(micError, _keep) ? this.micError : micError as String?,
        heardAt: heardAt ?? this.heardAt,
        readBackAt: readBackAt ?? this.readBackAt,
      );
}

const Object _keep = Object();

/// The sentence read after parsing (FR-VOICE-03).
String readBackSentence(TransactionDraft d) {
  final name = categoryByKey(d.categoryKey)?.nameBn;
  if (name == null) return 'কিসের জন্য? নিচের ছবিতে চাপ দিন।';
  return draftToSpeech(
    type: d.type,
    amountPaisa: d.amountPaisa,
    categoryName: name,
  );
}

class EntryController extends StateNotifier<EntryState> {
  EntryController(this._ref) : super(const EntryState());

  final Ref _ref;

  /// Shows entries the AI already understood while the phone was offline (FR-SYNC-03).
  Future<void> loadQueued() async {
    final ready = await _ref.read(entryRepositoryProvider).readyDrafts();
    if (!mounted || ready.isEmpty || state.phase != EntryPhase.idle) return;
    state = state.copyWith(phase: EntryPhase.drafts, drafts: ready);
  }

  Future<void> listen() async {
    final voice = _ref.read(voiceServiceProvider);
    await voice.stopSpeaking();
    state = state.copyWith(phase: EntryPhase.listening, micError: null);
    await voice.listen(
      (heard) => submit(heard, source: EntrySource.voice),
      onError: (e) {
        if (mounted) {
          state = state.copyWith(phase: EntryPhase.idle, micError: e);
        }
      },
    );
  }

  Future<void> stopListening() async {
    await _ref.read(voiceServiceProvider).stopListening();
    if (mounted && state.phase == EntryPhase.listening) {
      state = state.copyWith(phase: EntryPhase.idle);
    }
  }

  /// Parses [text] (quick parser first, then the AI) and reads the first draft back.
  Future<void> submit(String text, {required EntrySource source}) async {
    final clock = _ref.read(entryClockProvider);
    state = EntryState(
      phase: EntryPhase.parsing,
      transcript: text,
      heardAt: clock(),
    );
    try {
      final drafts =
          await _ref.read(entryRepositoryProvider).parse(text, source: source);
      if (!mounted) return;
      state = state.copyWith(
        phase: drafts.isEmpty ? EntryPhase.idle : EntryPhase.drafts,
        drafts: drafts,
        problem: drafts.isEmpty,
      );
      if (drafts.isEmpty) {
        await _speak('কিছু বোঝা যায়নি। আবার বলুন।');
      } else {
        await readBack(drafts.first);
      }
    } on QuotaExceeded {
      if (mounted) {
        state = state.copyWith(phase: EntryPhase.idle, quotaExceeded: true);
      }
    } on QueuedOffline {
      if (mounted) {
        state = state.copyWith(phase: EntryPhase.idle, queuedOffline: true);
      }
    } on AiUnavailable {
      if (mounted) {
        state = state.copyWith(phase: EntryPhase.idle, problem: true);
      }
    } on ApiException {
      if (mounted) {
        state = state.copyWith(phase: EntryPhase.idle, problem: true);
      }
    }
  }

  Future<void> _speak(String text) async {
    // No Bangla voice: show the text only, no auto read-aloud (FR-VOICE-07).
    final caps = _ref.read(voiceCapabilityProvider).value;
    if (caps != null && caps.ttsMissingBangla) return;
    await _ref.read(voiceServiceProvider).speak(text);
  }

  Future<void> readBack(TransactionDraft d) async {
    if (mounted) {
      state = state.copyWith(readBackAt: _ref.read(entryClockProvider)());
    }
    await _speak(readBackSentence(d));
  }

  /// A category chosen on the picture picker; the entry is read back again.
  Future<void> setCategory(int i, String key) async {
    final drafts = [...state.drafts];
    drafts[i] = drafts[i].copyWith(categoryKey: key);
    state = state.copyWith(drafts: drafts);
    await readBack(drafts[i]);
  }

  /// Drops draft [i] (✗) and removes it from the offline queue when it came from there.
  Future<void> discard(int i) async {
    final d = state.drafts[i];
    if (d.pendingId != null) {
      await _ref.read(entryRepositoryProvider).discard(d);
    }
    _remove(i);
  }

  void _remove(int i) {
    if (!mounted) return;
    final drafts = [...state.drafts]..removeAt(i);
    state = state.copyWith(
      phase: drafts.isEmpty ? EntryPhase.idle : EntryPhase.drafts,
      drafts: drafts,
    );
  }

  /// Saves draft [i] on the phone with its own source (voice stays `voice`). Returns false when
  /// the category is still missing.
  Future<bool> save(int i) async {
    final d = state.drafts[i];
    if (d.categoryKey == null && d.type != 'transfer') return false;
    state = state.copyWith(phase: EntryPhase.saving);
    try {
      final family = await _ref.read(currentFamilyProvider.future);
      final me = await _ref.read(myUserIdProvider.future);
      final store = _ref.read(localStoreProvider);
      await _ref.read(transactionRepositoryProvider).add(
            familyId: family.id,
            type: d.type,
            amountPaisa: d.amountPaisa,
            feePaisa: d.feePaisa,
            occurredAt: DateTime.parse(d.occurredAt),
            categoryId: await store.categoryIdForKey(d.categoryKey),
            accountId: await store.accountIdForType(d.accountType),
            note: d.note.isEmpty ? null : d.note,
            counterparty: d.counterparty,
            source: d.source,
            paidByUserId: me,
            createdBy: me,
          );
      if (d.pendingId != null) {
        await _ref.read(entryRepositoryProvider).discard(d);
      }
      _remove(i);
      unawaited(_ref.read(entryAfterSaveProvider)());
      return true;
    } catch (_) {
      if (mounted) state = state.copyWith(phase: EntryPhase.drafts);
      rethrow;
    }
  }
}

final entryControllerProvider =
    StateNotifierProvider.autoDispose<EntryController, EntryState>(
  (ref) => EntryController(ref),
);
