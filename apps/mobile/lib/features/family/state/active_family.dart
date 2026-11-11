import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/family_scope.dart';
import '../../../domain/models/api/me.dart';
import '../../../presentation/providers/auth_provider.dart';
import '../../../presentation/providers/providers.dart';
import '../data/family_list_repository.dart';

export '../data/family_list_repository.dart' show kActiveFamilyKey;

/// The id the user chose, remembered per device in `Meta('active_family')`.
class ActiveFamilyIdNotifier extends StateNotifier<String?> {
  final Ref _ref;
  late final Future<void> loaded;

  ActiveFamilyIdNotifier(this._ref) : super(null) {
    loaded = _load();
  }

  Future<void> _load() async {
    final stored =
        await _ref.read(localStoreProvider).getMeta(kActiveFamilyKey);
    if (mounted && state == null) state = stored;
  }

  /// Switches family: remembers it and clears family-scoped state.
  Future<void> select(String familyId) async {
    if (state == familyId) return;
    state = familyId;
    invalidateFamilyScoped(_ref.container);
    await _ref.read(localStoreProvider).setMeta(kActiveFamilyKey, familyId);
  }
}

final activeFamilyIdProvider =
    StateNotifierProvider<ActiveFamilyIdNotifier, String?>(
  (ref) => ActiveFamilyIdNotifier(ref),
);

/// Every family the signed-in user belongs to (from `GET /v1/me`).
final familiesProvider = Provider<List<FamilyInfo>>(
  (ref) => ref.watch(authProvider.select((s) => s.families)),
);

/// The family the app works on: the remembered one while still a member, else the first.
final activeFamilyProvider = Provider<FamilyInfo?>((ref) {
  final families = ref.watch(familiesProvider);
  if (families.isEmpty) return null;
  return chooseActiveFamily(families, ref.watch(activeFamilyIdProvider));
});
