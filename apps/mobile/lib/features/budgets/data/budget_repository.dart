import 'dart:async';
import 'dart:convert';

import 'package:drift/drift.dart';

import '../../../core/speech/budget_alerts.dart';
import '../../../data/api/api_exception.dart';
import '../../../data/api/budget_api.dart';
import '../../../data/database/database.dart';
import '../../../data/database/local_store.dart';
import '../../../domain/models/api/budget.dart' show FestivalBudget;

export '../../../core/speech/budget_alerts.dart' show BudgetStatus;
export '../../../domain/models/api/budget.dart' show FestivalBudget;

/// One budget to save: a category limit, or the overall limit when [categoryId] is null (paisa).
class BudgetInput {
  const BudgetInput(this.categoryId, this.limitPaisa);

  final String? categoryId;
  final int limitPaisa;

  Map<String, dynamic> toJson() => {
        'categoryId': categoryId,
        'limitPaisa': limitPaisa,
      };
}

/// Budgets of the active family (FR-BUD-01).
abstract class BudgetRepository {
  /// Budgets of [month] (`YYYY-MM`) with spend and level, from the local cache.
  Stream<List<BudgetStatus>> watch(String month);

  /// Saves limits for [month] (default: this month) with `PUT /budgets?month=`. Returns false when
  /// the phone is offline: the edit is then shown at once and queued in `Meta('budget_patch')`.
  Future<bool> put(List<BudgetInput> inputs, {String? month});

  /// Sends edits made offline.
  Future<void> flushQueued();

  /// Festival budgets, newest first; empty when they cannot be fetched.
  Future<List<FestivalBudget>> festivals();
}

const budgetPatchKey = 'budget_patch';

/// `ok` under 80%, `warning` from 80%, `exceeded` from 100% (integer maths, no floats).
String levelFor(int limitPaisa, int spentPaisa) {
  if (limitPaisa <= 0) return 'ok';
  if (spentPaisa >= limitPaisa) return 'exceeded';
  if (spentPaisa * 100 >= limitPaisa * 80) return 'warning';
  return 'ok';
}

/// Local cache plus the budget API.
class ApiBudgetRepository implements BudgetRepository {
  ApiBudgetRepository(
    this._store,
    this._api,
    this._familyId, {
    Future<void> Function()? refresh,
  }) : _refresh = refresh;

  final LocalStore _store;
  final BudgetApi _api;
  final String _familyId;
  final Future<void> Function()? _refresh;

  static String _currentMonth() {
    final d = DateTime.now().toUtc().add(const Duration(hours: 6));
    return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}';
  }

  @override
  Stream<List<BudgetStatus>> watch(String month) =>
      _store.watchBudgets(_familyId, month).asyncMap((rows) async {
        final names = {
          for (final c in await _store.categories()) c.id: c.nameBn,
        };
        final out = [
          for (final b in rows)
            BudgetStatus(
              b.categoryId,
              b.categoryId == null ? 'মোট' : (names[b.categoryId] ?? ''),
              b.limitPaisa,
              b.spentPaisa,
              b.level,
            ),
        ];
        // The overall budget first, then the biggest limits.
        out.sort((a, b) {
          if (a.categoryId == null) return -1;
          if (b.categoryId == null) return 1;
          return b.limitPaisa.compareTo(a.limitPaisa);
        });
        return out;
      });

  Future<Map<String, List<Map<String, dynamic>>>> _queue() async {
    final raw = await _store.getMeta(budgetPatchKey);
    if (raw == null) return {};
    final m = jsonDecode(raw) as Map<String, dynamic>;
    return {
      for (final e in m.entries)
        e.key: [
          for (final r in e.value as List) (r as Map).cast<String, dynamic>(),
        ],
    };
  }

  Future<void> _saveQueue(Map<String, List<Map<String, dynamic>>> q) async {
    if (q.isEmpty) {
      await (_store.db.delete(
        _store.db.meta,
      )..where((m) => m.key.equals(budgetPatchKey)))
          .go();
    } else {
      await _store.setMeta(budgetPatchKey, jsonEncode(q));
    }
  }

  /// Shows the new limits in the cache straight away.
  Future<void> _applyLocally(String month, List<BudgetInput> inputs) async {
    final db = _store.db;
    for (final i in inputs) {
      final id = '$_familyId:$month:${i.categoryId ?? 'overall'}';
      final old = await (db.select(
        db.cachedBudgets,
      )..where((b) => b.id.equals(id)))
          .getSingleOrNull();
      final spent = old?.spentPaisa ?? 0;
      await db.into(db.cachedBudgets).insertOnConflictUpdate(
            CachedBudgetsCompanion.insert(
              id: id,
              familyId: _familyId,
              categoryId: Value(i.categoryId),
              month: month,
              limitPaisa: i.limitPaisa,
              spentPaisa: Value(spent),
              level: Value(levelFor(i.limitPaisa, spent)),
            ),
          );
    }
  }

  Future<void> _send(String month, List<Map<String, dynamic>> rows) =>
      _api.setBudgets(_familyId, {'budgets': rows}, month: month);

  @override
  Future<bool> put(List<BudgetInput> inputs, {String? month}) async {
    final m = month ?? _currentMonth();
    await flushQueued();
    await _applyLocally(m, inputs);
    try {
      await _send(m, [for (final i in inputs) i.toJson()]);
    } on ApiException catch (e) {
      if (e.status != 0 && e.status < 500) rethrow;
      final q = await _queue();
      final byCat = {
        for (final r in q[m] ?? const <Map<String, dynamic>>[])
          r['categoryId']: r,
      };
      for (final i in inputs) {
        byCat[i.categoryId] = i.toJson();
      }
      q[m] = byCat.values.toList();
      await _saveQueue(q);
      return false;
    }
    try {
      await _refresh?.call();
    } catch (_) {
      // The local copy already shows the new limits.
    }
    return true;
  }

  @override
  Future<void> flushQueued() async {
    final q = await _queue();
    if (q.isEmpty) return;
    for (final month in q.keys.toList()) {
      try {
        await _send(month, q[month]!);
        q.remove(month);
      } on ApiException catch (e) {
        if (e.status == 0 || e.status >= 500) break; // still offline
        q.remove(month); // rejected for good (for example the role changed)
      }
    }
    await _saveQueue(q);
  }

  @override
  Future<List<FestivalBudget>> festivals() async {
    try {
      return await _api.festivalBudgets(_familyId);
    } catch (_) {
      return const [];
    }
  }
}

/// A family is not chosen yet: nothing to show.
class EmptyBudgetRepository implements BudgetRepository {
  const EmptyBudgetRepository();

  @override
  Stream<List<BudgetStatus>> watch(String month) =>
      Stream.value(const <BudgetStatus>[]);

  @override
  Future<bool> put(List<BudgetInput> inputs, {String? month}) async => false;

  @override
  Future<void> flushQueued() async {}

  @override
  Future<List<FestivalBudget>> festivals() async => const [];
}

/// In-memory repository for tests. [emit] pushes a new list to every watcher.
class FakeBudgetRepository implements BudgetRepository {
  FakeBudgetRepository({
    List<BudgetStatus> budgets = const [],
    this.festivalList = const [],
  }) : _current = budgets;

  final List<FestivalBudget> festivalList;
  final List<List<BudgetInput>> saved = [];
  List<BudgetStatus> _current;
  final _changes = StreamController<List<BudgetStatus>>.broadcast();

  void emit(List<BudgetStatus> budgets) {
    _current = budgets;
    _changes.add(budgets);
  }

  @override
  Stream<List<BudgetStatus>> watch(String month) async* {
    yield _current;
    yield* _changes.stream;
  }

  @override
  Future<bool> put(List<BudgetInput> inputs, {String? month}) async {
    saved.add(inputs);
    return true;
  }

  @override
  Future<void> flushQueued() async {}

  @override
  Future<List<FestivalBudget>> festivals() async => festivalList;
}
