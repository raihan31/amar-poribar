import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/database/database.dart';
import '../../../presentation/providers/providers.dart';
import '../../family/state/family_providers.dart';
import '../data/local_transaction_repository.dart';
import '../data/transaction_repository.dart';

/// The local-first repository; tests override it with `FakeTransactionRepository`.
final transactionRepositoryProvider = Provider<TransactionRepository>(
  (ref) => LocalTransactionRepository(ref.watch(localStoreProvider)),
);

/// Cached categories (hidden ones are filtered by the screen). Tests override it.
final addCategoriesProvider = FutureProvider<List<CachedCategory>>(
  (ref) => ref.watch(localStoreProvider).categories(),
);

/// Cached accounts; archived ones are dropped. Tests override it.
final addAccountsProvider = StreamProvider<List<CachedAccount>>(
  (ref) => ref.watch(localStoreProvider).watchAccounts().map(
        (all) => [
          for (final a in all)
            if (!a.archived) a,
        ],
      ),
);

/// Where "now" comes from for the date shortcuts; tests override it.
final addExpenseClockProvider =
    Provider<DateTime Function()>((_) => DateTime.now);

/// Largest amount D4 accepts: 1 crore taka (FR-TXN-09), in paisa.
const int kMaxAmountPaisa = 10000000 * 100;

const _maxDigits = 9;

enum AddExpenseError { amount, tooLarge, category }

class AddExpenseState {
  const AddExpenseState({
    this.type = 'expense',
    this.digits = '',
    this.categoryId,
    this.accountId,
    this.paidByUserId,
    this.daysAgo = 0,
    this.note = '',
    this.feeDigits = '',
    this.showFee = false,
    this.isPrivate = false,
    this.saving = false,
    this.error,
    this.editing,
    this.dateTouched = false,
  });

  /// The entry being edited (D5 edit mode), or `null` when adding.
  final Transaction? editing;

  /// Edit mode keeps the original date-time until the person picks a date pill.
  final bool dateTouched;

  /// `expense`, `income` or `transfer`.
  final String type;

  /// Whole taka, Latin digits, no leading zeros.
  final String digits;
  final String? categoryId;
  final String? accountId;

  /// `null` means me.
  final String? paidByUserId;

  /// 0 = today, 1 = yesterday.
  final int daysAgo;
  final String note;
  final String feeDigits;
  final bool showFee;
  final bool isPrivate;
  final bool saving;
  final AddExpenseError? error;

  bool get needsCategory => type != 'transfer';
  int get amountPaisa => digits.isEmpty ? 0 : int.parse(digits) * 100;
  int get feePaisa => feeDigits.isEmpty ? 0 : int.parse(feeDigits) * 100;

  AddExpenseState copyWith({
    String? type,
    String? digits,
    Object? categoryId = _keep,
    String? accountId,
    Object? paidByUserId = _keep,
    int? daysAgo,
    String? note,
    String? feeDigits,
    bool? showFee,
    bool? isPrivate,
    bool? saving,
    Object? error = _keep,
    Transaction? editing,
    bool? dateTouched,
  }) =>
      AddExpenseState(
        type: type ?? this.type,
        digits: digits ?? this.digits,
        categoryId: identical(categoryId, _keep)
            ? this.categoryId
            : categoryId as String?,
        accountId: accountId ?? this.accountId,
        paidByUserId: identical(paidByUserId, _keep)
            ? this.paidByUserId
            : paidByUserId as String?,
        daysAgo: daysAgo ?? this.daysAgo,
        note: note ?? this.note,
        feeDigits: feeDigits ?? this.feeDigits,
        showFee: showFee ?? this.showFee,
        isPrivate: isPrivate ?? this.isPrivate,
        saving: saving ?? this.saving,
        error: identical(error, _keep) ? this.error : error as AddExpenseError?,
        editing: editing ?? this.editing,
        dateTouched: dateTouched ?? this.dateTouched,
      );
}

const Object _keep = Object();

class AddExpenseController extends StateNotifier<AddExpenseState> {
  AddExpenseController(this._ref) : super(const AddExpenseState());

  final Ref _ref;

  void setType(String type) {
    if (type == state.type) return;
    // A category belongs to expense or income; switching clears it.
    state = state.copyWith(type: type, categoryId: null, error: null);
  }

  /// Appends `'0'..'9'` or `'00'`; the amount stays whole taka up to the 1 crore ceiling.
  void pressDigits(String d) {
    var next = state.digits + d;
    next = next.replaceFirst(RegExp(r'^0+'), '');
    if (next.length > _maxDigits) return;
    state = state.copyWith(digits: next, error: null);
  }

  void backspace() {
    if (state.digits.isEmpty) return;
    state = state.copyWith(
      digits: state.digits.substring(0, state.digits.length - 1),
      error: null,
    );
  }

  void setCategory(String id) =>
      state = state.copyWith(categoryId: id, error: null);

  void setAccount(String id) => state = state.copyWith(accountId: id);

  /// Picks [id] as the account only when the person has not chosen one yet.
  void defaultAccount(String id) {
    if (state.accountId == null) state = state.copyWith(accountId: id);
  }

  void setPaidBy(String? userId) =>
      state = state.copyWith(paidByUserId: userId);

  void setDaysAgo(int days) =>
      state = state.copyWith(daysAgo: days, dateTouched: true);

  /// Fills the form from [t] and switches to edit mode: [save] then updates [t] in place.
  void loadForEdit(Transaction t) {
    state = AddExpenseState(
      type: t.type,
      digits: '${t.amountPaisa ~/ 100}',
      categoryId: t.categoryId,
      accountId: t.accountId,
      paidByUserId: t.paidByUserId,
      daysAgo: -1,
      note: t.note ?? '',
      feeDigits: t.feePaisa == 0 ? '' : '${t.feePaisa ~/ 100}',
      showFee: t.feePaisa != 0,
      isPrivate: t.isPrivate,
      editing: t,
    );
  }

  void setNote(String note) => state = state.copyWith(note: note);

  void setFee(String digits) => state = state.copyWith(
        feeDigits: digits.replaceAll(RegExp('[^0-9]'), '').replaceFirst(
              RegExp(r'^0+'),
              '',
            ),
      );

  void showFee() => state = state.copyWith(showFee: true);
  void setPrivate(bool v) => state = state.copyWith(isPrivate: v);

  AddExpenseError? validate() {
    if (state.amountPaisa <= 0) return AddExpenseError.amount;
    if (state.amountPaisa > kMaxAmountPaisa) return AddExpenseError.tooLarge;
    if (state.needsCategory && state.categoryId == null) {
      return AddExpenseError.category;
    }
    return null;
  }

  /// Validates and writes the entry. Returns the new id, or `null` when invalid (see
  /// [AddExpenseState.error]). The write is local only; sync sends it later.
  Future<String?> save() async {
    if (state.saving) return null;
    final problem = validate();
    if (problem != null) {
      state = state.copyWith(error: problem);
      return null;
    }
    state = state.copyWith(saving: true, error: null);
    try {
      final old = state.editing;
      if (old != null) return await _update(old);
      final family = await _ref.read(currentFamilyProvider.future);
      final me = await _ref.read(myUserIdProvider.future);
      final now = _ref.read(addExpenseClockProvider)();
      return await _ref.read(transactionRepositoryProvider).add(
            familyId: family.id,
            type: state.type,
            amountPaisa: state.amountPaisa,
            feePaisa: state.feePaisa,
            occurredAt: now.subtract(Duration(days: state.daysAgo)),
            categoryId: state.needsCategory ? state.categoryId : null,
            accountId: state.accountId,
            note: state.note.trim().isEmpty ? null : state.note.trim(),
            source: 'manual',
            isPrivate: state.isPrivate,
            paidByUserId: state.paidByUserId ?? me,
            createdBy: me,
          );
    } finally {
      if (mounted) state = state.copyWith(saving: false);
    }
  }

  Future<String> _update(Transaction old) async {
    final me = await _ref.read(myUserIdProvider.future);
    final now = _ref.read(addExpenseClockProvider)();
    // The keypad edits whole taka; keep a paisa amount untouched unless the person changed it.
    final sameAmount = state.amountPaisa == (old.amountPaisa ~/ 100) * 100;
    await _ref.read(transactionRepositoryProvider).update(
          old.id,
          type: state.type,
          amountPaisa: sameAmount ? null : state.amountPaisa,
          feePaisa: state.feePaisa,
          occurredAt: state.dateTouched
              ? now.subtract(Duration(days: state.daysAgo))
              : null,
          categoryId: state.needsCategory ? state.categoryId : null,
          accountId: state.accountId,
          note: state.note.trim(),
          isPrivate: state.isPrivate,
          paidByUserId: state.paidByUserId ?? me,
        );
    return old.id;
  }
}

final addExpenseControllerProvider =
    StateNotifierProvider.autoDispose<AddExpenseController, AddExpenseState>(
  (ref) => AddExpenseController(ref),
);
