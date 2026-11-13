import 'dart:ui' show Locale;

import '../../../domain/models/api/me.dart';
import 'onboarding_repository.dart';

/// In-memory repository that records calls. Set [failFamilyTimes] to make the first N
/// `createFamily` calls throw.
class FakeOnboardingRepository implements OnboardingRepository {
  FakeOnboardingRepository({
    this.version = '2026-11',
    this.failFamilyTimes = 0,
    this.body =
        'গোপনীয়তা নীতির পূর্ণ লেখা।\n\nআপনার তথ্য আপনার পরিবারের জন্য।',
  });

  final String version;
  final String body;
  int failFamilyTimes;

  final List<(String, String)> consents = [];
  final List<String> createdFamilies = [];

  @override
  Future<PolicyDoc> policy(Locale locale) async => PolicyDoc(
        version: version,
        locale: locale.languageCode,
        title: 'গোপনীয়তা নীতি',
        body: body,
      );

  @override
  Future<void> acceptConsent(String version, Locale locale) async {
    consents.add((version, locale.languageCode));
  }

  @override
  Future<FamilyInfo> createFamily(String name) async {
    if (failFamilyTimes > 0) {
      failFamilyTimes--;
      throw Exception('offline');
    }
    createdFamilies.add(name);
    return FamilyInfo('f-${createdFamilies.length}', name, 'owner');
  }
}
