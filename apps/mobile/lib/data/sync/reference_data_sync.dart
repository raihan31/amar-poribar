import '../api/api_client.dart';
import '../database/local_store.dart';

/// Pulls the read-only reference data (FR-SYNC-08) and caches it for offline screens. The six requests run
/// in parallel; each cache part is replaced only when its own request succeeded, so one failing endpoint
/// leaves the old data in place. Returns one message per failed part.
class ReferenceDataSync {
  final ApiClient api;
  final LocalStore store;
  final DateTime Function() _now;
  ReferenceDataSync(this.api, this.store, {DateTime Function()? now})
      : _now = now ?? DateTime.now;

  static String _month(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}';

  Future<List<String>> refresh(String familyId) async {
    final now = _now();
    final current = _month(now);
    final previous = _month(DateTime.utc(now.year, now.month - 1));
    final errors = <String>[];

    Future<void> part(String name, Future<void> Function() run) async {
      try {
        await run();
      } catch (e) {
        errors.add('$name: $e');
      }
    }

    // Fetch and store inside one guarded step per part, all parts concurrently.
    await Future.wait([
      part('categories', () async {
        await store.replaceCategories(await api.categories(familyId));
      }),
      part('accounts', () async {
        await store.replaceAccounts(await api.accounts(familyId));
      }),
      part('budgets', () async {
        final rows = await Future.wait([
          api.budgets(familyId, month: current),
          api.budgets(familyId, month: previous),
        ]);
        await store.replaceBudgets(familyId, [...rows[0], ...rows[1]]);
      }),
      part('members', () async {
        await store.replaceMembers(familyId, await api.members(familyId));
      }),
      part('entitlements', () async {
        await store.replaceEntitlements(
          familyId,
          await api.entitlements(familyId),
        );
      }),
    ]);
    return errors;
  }
}
