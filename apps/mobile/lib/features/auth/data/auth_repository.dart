import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/api/api_providers.dart';
import '../../../data/auth/token_store.dart';
import '../../../presentation/providers/auth_provider.dart';
import 'api_auth_repository.dart';

export '../../../data/auth/token_store.dart' show Tokens;

class OtpChallenge {
  final int resendAfterSeconds;
  final int attemptsLeft;
  final String? devCode;
  const OtpChallenge({
    required this.resendAfterSeconds,
    this.attemptsLeft = 5,
    this.devCode,
  });
}

/// Sends and checks one-time codes. `phone` is `+8801XXXXXXXXX`.
/// Both methods throw `OtpError` on failure.
abstract class AuthRepository {
  Future<OtpChallenge> requestOtp(String phone);
  Future<Tokens> verifyOtp(String phone, String code);
}

/// The real repository; tests override it with `FakeAuthRepository`.
final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => ApiAuthRepository(
    ref.watch(authApiProvider),
    ref.watch(tokenStoreProvider),
  ),
);
