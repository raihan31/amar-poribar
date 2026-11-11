import 'package:amar_poribar/data/auth/token_store.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:amar_poribar/features/family/data/fake_family_repository.dart';
import 'package:amar_poribar/features/family/data/invite_repository.dart';
import 'package:amar_poribar/features/family/state/family_providers.dart';
import 'package:amar_poribar/features/home/data/home_repository.dart';
import 'package:amar_poribar/features/home/state/home_providers.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:amar_poribar/presentation/providers/providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'fake_voice_service.dart';

/// A clock tests can move by hand.
class FakeClock {
  DateTime _now;
  FakeClock([DateTime? start]) : _now = start ?? DateTime.utc(2026, 11, 9, 4);

  DateTime now() => _now;
  void advance(Duration d) => _now = _now.add(d);
}

/// The overrides every screen test starts with. [store] is opened by `pumpApp` (an in-memory
/// `AppDatabase.memory()`).
///
/// Each screen task adds its `Fake<Feature>Repository` override here, one line per fake.
List<Override> defaultFakes({
  required LocalStore store,
  required FakeVoiceService voice,
  TokenStore? tokens,
}) =>
    [
      localStoreProvider.overrideWithValue(store),
      tokenStoreProvider.overrideWithValue(tokens ?? MemoryTokenStore()),
      voiceServiceProvider.overrideWithValue(voice),
      familyRepositoryProvider.overrideWithValue(FakeFamilyRepository()),
      myUserIdProvider.overrideWith((ref) async => FakeFamilyRepository.meId),
      inviteRepositoryProvider.overrideWithValue(FakeInviteRepository()),
      inviteClockProvider.overrideWithValue(() => DateTime.utc(2026, 11, 9, 4)),
      // Home: no database streams in widget tests; a test that needs budgets overrides the last one
      // with `topBudgetWarningProvider.overrideWith(realTopBudgetWarning)`.
      homeRepositoryProvider.overrideWithValue(FakeHomeRepository()),
      topBudgetWarningProvider.overrideWithValue(null),
      // <feature fakes go here>
    ];
