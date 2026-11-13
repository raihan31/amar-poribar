import 'dart:ui' show Locale;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/redirects.dart';
import '../../../presentation/providers/providers.dart';
import '../data/onboarding_repository.dart';

/// Compares the stored `Meta('consent_version')` with the version of `GET /v1/policy` and, when
/// they differ, makes `consentCurrentProvider` false so the router sends the user to `/consent`
/// again (FR-AUTH-10). Offline or on any error the stored answer stays.
Future<void> checkConsent(
  ProviderContainer container, {
  Locale locale = const Locale('bn'),
}) async {
  try {
    final stored =
        await container.read(localStoreProvider).getMeta(consentVersionKey);
    final policy =
        await container.read(onboardingRepositoryProvider).policy(locale);
    container.read(consentCurrentProvider.notifier).state =
        stored != null && stored == policy.version;
  } catch (_) {
    // Cannot reach the server: keep what bootstrap decided from the stored value.
  }
}
