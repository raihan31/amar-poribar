import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/sms_parser/sms_parser_engine.dart';
import '../../../data/api/api_exception.dart';
import '../../../domain/models/api/draft.dart';
import '../../../presentation/providers/providers.dart';
import '../../family/state/family_providers.dart';
import '../../transactions/state/add_expense_controller.dart';
import '../data/entry_repository.dart';
import 'entry_controller.dart';

/// "Is this TrxID already on the phone?" (AC-04). Tests may replace it.
final smsTrxIdExistsProvider =
    Provider<Future<bool> Function(String familyId, String trxId)>(
  (ref) => (familyId, trxId) =>
      ref.read(localStoreProvider).existsTrxId(familyId, trxId),
);

enum SmsPhase { idle, parsing, result, saving }

/// What A5 shows. The pasted text itself is never part of the state (T-MOB-30 step 6).
class SmsPasteState {
  const SmsPasteState({
    this.phase = SmsPhase.idle,
    this.draft,
    this.provider,
    this.kind,
    this.usedAi = false,
    this.duplicate = false,
    this.quotaExceeded = false,
    this.offline = false,
    this.problem = false,
    this.balancePaisa,
  });

  final SmsPhase phase;
  final TransactionDraft? draft;

  /// bKash, Nagad or Rocket when a template matched.
  final SmsProvider? provider;

  /// Which template matched; null for AI results.
  final SmsKind? kind;
  final bool usedAi;

  /// A live entry with this TrxID is already on the phone (AC-04).
  final bool duplicate;
  final bool quotaExceeded;
  final bool offline;
  final bool problem;
  final int? balancePaisa;

  SmsPasteState copyWith({
    SmsPhase? phase,
    TransactionDraft? draft,
    bool? duplicate,
  }) =>
      SmsPasteState(
        phase: phase ?? this.phase,
        draft: draft ?? this.draft,
        provider: provider,
        kind: kind,
        usedAi: usedAi,
        duplicate: duplicate ?? this.duplicate,
        quotaExceeded: quotaExceeded,
        offline: offline,
        problem: problem,
        balancePaisa: balancePaisa,
      );
}

/// The category chips of A5: the message's own category or the provider default, then the
/// other choices of the board.
String defaultCategoryFor(SmsDraft d) {
  final named = d.categoryKey;
  if (named != null) return named;
  switch (d.kind) {
    case SmsKind.received:
    case SmsKind.cashIn:
      return 'other_income';
    case SmsKind.cashOut:
      return 'fees';
    case SmsKind.send:
      return _looksLikePerson(d.counterpartyMasked)
          ? 'family_support'
          : 'other_expense';
    case SmsKind.bill:
    case SmsKind.recharge:
    case SmsKind.payment:
      return 'other_expense';
  }
}

bool _looksLikePerson(String? who) =>
    who != null && RegExp(r'^[0-9X\-+ ]{6,}$').hasMatch(who);

class SmsPasteController extends StateNotifier<SmsPasteState> {
  SmsPasteController(this._ref) : super(const SmsPasteState());

  final Ref _ref;

  /// Reads [text] on the phone; only when no template matches does it ask the AI (AC-03). The
  /// text is not kept anywhere after this returns.
  Future<void> submit(String text) async {
    state = const SmsPasteState(phase: SmsPhase.parsing);
    final local = parseMfsSms(text, now: _ref.read(entryClockProvider)());
    if (local != null) {
      final draft = TransactionDraft(
        type: local.type,
        amountPaisa: local.amountPaisa,
        feePaisa: local.feePaisa,
        occurredAt: local.occurredAt.toUtc().toIso8601String(),
        categoryKey: defaultCategoryFor(local),
        accountType: local.provider.name,
        note: local.note,
        counterparty: local.counterpartyMasked,
        trxId: local.trxId,
        source: EntrySource.sms.wire,
        confidence: 0.99,
      );
      await _show(
        draft,
        provider: local.provider,
        kind: local.kind,
        balance: local.balancePaisa,
      );
      return;
    }
    try {
      final drafts = await _ref
          .read(entryRepositoryProvider)
          .parse(text, source: EntrySource.sms);
      if (!mounted) return;
      if (drafts.isEmpty) {
        state = const SmsPasteState(problem: true);
        return;
      }
      await _show(
        drafts.first.copyWith(source: EntrySource.sms.wire),
        usedAi: true,
      );
    } on QuotaExceeded {
      if (mounted) state = const SmsPasteState(quotaExceeded: true);
    } on QueuedOffline {
      if (mounted) state = const SmsPasteState(offline: true);
    } on AiUnavailable {
      if (mounted) state = const SmsPasteState(problem: true);
    } on ApiException {
      if (mounted) state = const SmsPasteState(problem: true);
    }
  }

  Future<void> _show(
    TransactionDraft draft, {
    SmsProvider? provider,
    SmsKind? kind,
    int? balance,
    bool usedAi = false,
  }) async {
    final trx = draft.trxId;
    var duplicate = false;
    if (trx != null) {
      final family = await _ref.read(currentFamilyProvider.future);
      duplicate = await _ref.read(smsTrxIdExistsProvider)(family.id, trx);
    }
    if (!mounted) return;
    state = SmsPasteState(
      phase: SmsPhase.result,
      draft: draft,
      provider: provider,
      kind: kind,
      usedAi: usedAi,
      duplicate: duplicate,
      balancePaisa: balance,
    );
  }

  void setCategory(String key) {
    final d = state.draft;
    if (d == null) return;
    state = state.copyWith(draft: d.copyWith(categoryKey: key));
  }

  /// "না": forget the result and wait for the next message.
  void discard() => state = const SmsPasteState();

  /// "✓ রাখুন". Returns false when there is nothing to save or it is a duplicate.
  Future<bool> save() async {
    final d = state.draft;
    if (d == null || state.duplicate || state.phase != SmsPhase.result) {
      return false;
    }
    state = state.copyWith(phase: SmsPhase.saving);
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
            trxId: d.trxId,
            source: d.source,
            paidByUserId: me,
            createdBy: me,
          );
      unawaited(_ref.read(entryAfterSaveProvider)());
      if (mounted) state = const SmsPasteState();
      return true;
    } catch (_) {
      if (mounted) state = state.copyWith(phase: SmsPhase.result);
      rethrow;
    }
  }
}

final smsPasteControllerProvider =
    StateNotifierProvider.autoDispose<SmsPasteController, SmsPasteState>(
  (ref) => SmsPasteController(ref),
);
