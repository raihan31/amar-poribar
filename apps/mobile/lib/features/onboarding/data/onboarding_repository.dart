import 'dart:ui' show Locale;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/api/api_providers.dart';
import '../../../domain/models/api/me.dart';
import 'api_onboarding_repository.dart';

/// The privacy policy of `GET /v1/policy`: `{version, locale, title, body}`.
class PolicyDoc {
  const PolicyDoc({
    required this.version,
    required this.locale,
    required this.title,
    required this.body,
  });

  final String version;
  final String locale;
  final String title;
  final String body;

  /// The server sends the text as `text`; the task contract calls it `body`. Both are read.
  factory PolicyDoc.fromJson(Map<String, dynamic> j) => PolicyDoc(
        version: j['version'] as String,
        locale: (j['locale'] as String?) ?? 'bn',
        title: (j['title'] as String?) ?? '',
        body: ((j['body'] ?? j['text']) as String?) ?? '',
      );
}

/// Consent and the first family (A2). The real one calls the API; tests use
/// `FakeOnboardingRepository`.
abstract class OnboardingRepository {
  Future<PolicyDoc> policy(Locale locale);

  /// `POST /v1/me/consents {kind: "privacy", version, locale}`.
  Future<void> acceptConsent(String version, Locale locale);

  /// `POST /v1/families`.
  Future<FamilyInfo> createFamily(String name);
}

final onboardingRepositoryProvider = Provider<OnboardingRepository>(
  (ref) => ApiOnboardingRepository(
    ref.watch(privacyApiProvider),
    ref.watch(familyApiProvider),
  ),
);
