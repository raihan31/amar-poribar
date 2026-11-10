import '../../../data/api/api_exception.dart';
import '../../../data/api/auth_api.dart';
import '../../../data/auth/token_store.dart';
import '../domain/otp_failure.dart';
import 'auth_repository.dart';

/// Real implementation over `/v1/auth/otp/*`. [AuthApi] saves the tokens in the session;
/// [verifyOtp] returns them from [store].
class ApiAuthRepository implements AuthRepository {
  final AuthApi api;
  final TokenStore store;
  ApiAuthRepository(this.api, this.store);

  @override
  Future<OtpChallenge> requestOtp(String phone) async {
    try {
      final r = await api.requestOtpRaw(phone);
      return OtpChallenge(
        resendAfterSeconds: (r['resendAfterSeconds'] as num?)?.toInt() ?? 60,
        devCode: r['devCode'] as String?,
      );
    } catch (e) {
      throw OtpError(mapOtpFailure(e));
    }
  }

  @override
  Future<Tokens> verifyOtp(String phone, String code) async {
    try {
      await api.verifyOtp(phone, code);
      final t = await store.read();
      if (t != null) return t;
    } catch (e) {
      throw OtpError(mapOtpFailure(e));
    }
    throw const OtpError(Server());
  }
}

/// Maps an API error (`otp_invalid{attemptsLeft}`, `otp_expired`,
/// `otp_rate_limited{retryAfterSeconds}`) to an [OtpFailure].
OtpFailure mapOtpFailure(Object e) {
  if (e is OtpError) return e.failure;
  if (e is ApiException) {
    final d = e.details is Map
        ? e.details! as Map<String, dynamic>
        : const <String, dynamic>{};
    switch (e.code) {
      case 'otp_invalid':
        return Invalid((d['attemptsLeft'] as num?)?.toInt() ?? 0);
      case 'otp_expired':
        return const Expired();
      case 'otp_rate_limited':
        return RateLimited(
          Duration(seconds: (d['retryAfterSeconds'] as num?)?.toInt() ?? 60),
        );
    }
    return const Server();
  }
  return const Network();
}
