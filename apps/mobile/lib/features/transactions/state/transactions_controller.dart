import 'dart:async';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../data/database/database.dart';
import '../../family/state/active_family.dart';
import '../../family/state/family_providers.dart';
import '../../home/state/home_providers.dart';
import '../data/transaction_repository.dart';
import '../domain/txn_query.dart';
import 'add_expense_controller.dart';

const int kListPageSize = 50;

/// `YYYY-MM` moved by [delta] months.
String shiftMonth(String month, int delta) {
  final p = month.split('-');
  final index = int.parse(p[0]) * 12 + (int.parse(p[1]) - 1) + delta;
  final y = index ~/ 12;
  final m = index % 12 + 1;
  return '${y.toString().padLeft(4, '0')}-${m.toString().padLeft(2, '0')}';
}

/// The month the person navigated to; `null` means the current month.
final txnMonthChoiceProvider = StateProvider<String?>((_) => null);

/// The month the list shows.
final txnMonthProvider = Provider<String>(
  (ref) => ref.watch(txnMonthChoiceProvider) ?? ref.watch(homeMonthProvider),
);

/// One chip: everyone, one member or one account.
class TxnFilter {
  const TxnFilter({this.memberId, this.accountId});

  static const all = TxnFilter();

  final String? memberId;
  final String? accountId;

  @override
  bool operator ==(Object other) =>
      other is TxnFilter &&
      other.memberId == memberId &&
      other.accountId == accountId;

  @override
  int get hashCode => Object.hash(memberId, accountId);
}

final txnFilterProvider = StateProvider<TxnFilter>((_) => TxnFilter.all);

class TransactionsState {
  const TransactionsState({
    this.items = const [],
    this.nextCursor,
    this.loading = true,
    this.loadingMore = false,
  });

  final List<Transaction> items;
  final String? nextCursor;

  /// True until the first page arrived.
  final bool loading;
  final bool loadingMore;

  bool get hasMore => nextCursor != null;

  TransactionsState copyWith({
    List<Transaction>? items,
    String? nextCursor,
    bool clearCursor = false,
    bool? loading,
    bool? loadingMore,
  }) =>
      TransactionsState(
        items: items ?? this.items,
        nextCursor: clearCursor ? null : (nextCursor ?? this.nextCursor),
        loading: loading ?? this.loading,
        loadingMore: loadingMore ?? this.loadingMore,
      );
}

/// An infinite list over [TransactionRepository.page] (cursor paging). A new controller is built
/// whenever the month, the chip or the family changes.
class TransactionsController extends StateNotifier<TransactionsState> {
  TransactionsController(this._repo, this._query, {bool ready = true})
      : super(const TransactionsState()) {
    if (!ready) return;
    _load();
    // The first emission is the current content; later ones are changes (an entry saved, a sync).
    _watch = _repo.watch(_query).skip(1).listen((_) => refresh());
  }

  final TransactionRepository _repo;
  final TxnQuery _query;
  StreamSubscription<List<Transaction>>? _watch;

  Future<void> _load({int limit = kListPageSize}) async {
    try {
      final page = await _repo.page(_query, limit: limit);
      if (!mounted) return;
      state = TransactionsState(
        items: page.items,
        nextCursor: page.nextCursor,
        loading: false,
      );
    } catch (_) {
      // The local database failed to answer; show what is there.
      if (mounted) state = state.copyWith(loading: false);
    }
  }

  /// Fetches the next page when there is one.
  Future<void> loadMore() async {
    final cursor = state.nextCursor;
    if (cursor == null || state.loadingMore || state.loading) return;
    state = state.copyWith(loadingMore: true);
    try {
      final page =
          await _repo.page(_query, cursor: cursor, limit: kListPageSize);
      if (!mounted) return;
      state = state.copyWith(
        items: [...state.items, ...page.items],
        nextCursor: page.nextCursor,
        clearCursor: page.nextCursor == null,
        loadingMore: false,
      );
    } catch (_) {
      if (mounted) state = state.copyWith(loadingMore: false);
    }
  }

  /// Reloads everything that is already shown.
  Future<void> refresh() => _load(
        limit: state.items.length > kListPageSize
            ? state.items.length
            : kListPageSize,
      );

  /// Every row of the query, for the CSV.
  Future<List<Transaction>> allRows() async {
    final rows = <Transaction>[];
    String? cursor;
    do {
      final page = await _repo.page(_query, cursor: cursor, limit: 200);
      rows.addAll(page.items);
      cursor = page.nextCursor;
    } while (cursor != null);
    return rows;
  }

  @override
  void dispose() {
    _watch?.cancel();
    super.dispose();
  }
}

final transactionsControllerProvider = StateNotifierProvider.autoDispose<
    TransactionsController, TransactionsState>((ref) {
  final family = ref.watch(activeFamilyProvider);
  final month = ref.watch(txnMonthProvider);
  final filter = ref.watch(txnFilterProvider);
  final me = ref.watch(myUserIdProvider);
  final repo = ref.watch(transactionRepositoryProvider);
  if (family == null || me.isLoading) {
    return TransactionsController(
      repo,
      const TxnQuery(familyId: ''),
      ready: false,
    );
  }
  return TransactionsController(
    repo,
    TxnQuery(
      familyId: family.id,
      month: month,
      paidByUserId: filter.memberId,
      accountId: filter.accountId,
      viewerUserId: me.valueOrNull,
    ),
  );
});

/// The text that goes into the CSV for one cell: quoted when needed, and neutralised when a
/// spreadsheet would read it as a formula.
String csvField(String value) {
  var v = value;
  if (v.isNotEmpty && '=+-@\t\r'.contains(v[0])) v = "'$v";
  if (v.contains(RegExp('[",\n\r]'))) v = '"${v.replaceAll('"', '""')}"';
  return v;
}

const csvHeader = 'date,type,amount_paisa,category,account,member,note';

/// Builds the CSV text for [rows]; dates are Asia/Dhaka days.
String buildTransactionsCsv(
  List<Transaction> rows, {
  required Map<String, String> categories,
  required Map<String, String> accounts,
  required Map<String, String> members,
}) {
  final out = StringBuffer('$csvHeader\n');
  for (final t in rows) {
    final d =
        DateTime.parse(t.occurredAt).toUtc().add(const Duration(hours: 6));
    final date = '${d.year.toString().padLeft(4, '0')}-'
        '${d.month.toString().padLeft(2, '0')}-'
        '${d.day.toString().padLeft(2, '0')}';
    out.writeln(
      [
        date,
        t.type,
        '${t.amountPaisa}',
        csvField(categories[t.categoryId] ?? ''),
        csvField(accounts[t.accountId] ?? ''),
        csvField(members[t.paidByUserId] ?? ''),
        csvField(t.note ?? ''),
      ].join(','),
    );
  }
  return out.toString();
}

/// Hands a CSV file to the system share sheet. Tests override it.
typedef CsvSharer = Future<void> Function(String fileName, String csv);

final csvSharerProvider = Provider<CsvSharer>((_) => _shareCsvFile);

Future<void> _shareCsvFile(String fileName, String csv) async {
  final dir = await getTemporaryDirectory();
  final file = File('${dir.path}/$fileName');
  await file.writeAsString(csv);
  await SharePlus.instance.share(
    ShareParams(files: [XFile(file.path, mimeType: 'text/csv')]),
  );
}
