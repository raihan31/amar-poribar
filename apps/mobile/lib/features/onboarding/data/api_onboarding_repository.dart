import 'dart:ui' show Locale;

import '../../../data/api/family_api.dart';
import '../../../data/api/privacy_api.dart';
import '../../../domain/models/api/me.dart';
import 'onboarding_repository.dart';

/// Real implementation. `createFamily` does not touch the signed-in state: the screen refreshes
/// it after step 2, so the router does not leave `/consent` too early.
class ApiOnboardingRepository implements OnboardingRepository {
  ApiOnboardingRepository(this.privacy, this.family);

  final PrivacyApi privacy;
  final FamilyApi family;

  @override
  Future<PolicyDoc> policy(Locale locale) async =>
      PolicyDoc.fromJson(await privacy.policy(locale: locale.languageCode));

  @override
  Future<void> acceptConsent(String version, Locale locale) =>
      privacy.acceptConsent(version, locale.languageCode);

  @override
  Future<FamilyInfo> createFamily(String name) async {
    final f = await family.createFamily(name);
    return FamilyInfo(f.id, f.name, 'owner');
  }
}
