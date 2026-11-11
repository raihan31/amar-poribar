import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/family/state/budgets_provider.dart';

/// Providers whose data belongs to one family. They are invalidated when the active family
/// changes (T-MOB-12). Add every new family-scoped provider here.
final List<ProviderOrFamily> familyScoped = [
  budgetsProvider,
];

void invalidateFamilyScoped(ProviderContainer container) {
  for (final p in familyScoped) {
    container.invalidate(p);
  }
}
