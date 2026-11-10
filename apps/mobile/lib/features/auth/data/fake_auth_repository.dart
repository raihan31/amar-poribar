import '../domain/otp_failure.dart';
import 'auth_repository.dart';

/// In memory: accepts code `123456`. Scripted errors are thrown first, one per call.
class FakeAuthRepository implements AuthRepository {
  static const goodCode = '123456';

  final List<OtpError> requestErrors;
  final List<OtpError> verifyErrors;
  final int resendAfterSeconds;
  final List<String> requested = [];
  final List<String> verified = [];

  FakeAuthRepository({
    List<OtpError>? requestErrors,
    List<OtpError>? verifyErrors,
    this.resendAfterSeconds = 42,
  })  : requestErrors = [...?requestErrors],
        verifyErrors = [...?verifyErrors];

  @override
  Future<OtpChallenge> requestOtp(String phone) async {
    requested.add(phone);
    if (requestErrors.isNotEmpty) throw requestErrors.removeAt(0);
    return OtpChallenge(
      resendAfterSeconds: resendAfterSeconds,
      devCode: goodCode,
    );
  }

  @override
  Future<Tokens> verifyOtp(String phone, String code) async {
    verified.add(code);
    if (verifyErrors.isNotEmpty) throw verifyErrors.removeAt(0);
    if (code != goodCode) throw const OtpError(Invalid(4));
    return Tokens(
      access: 'fake-access',
      refresh: 'fake-refresh',
      accessExpiresAt: DateTime.utc(2030),
    );
  }
}
