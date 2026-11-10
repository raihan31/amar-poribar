import 'api_transport.dart';

/// `/v1/auth/*` and the signed-in user's profile.
class AuthApi {
  final ApiTransport _t;
  AuthApi(this._t);

  /// Sends an OTP. Outside production the API also returns the code (`devCode`) for local testing.
  Future<String?> requestOtp(String phone) async {
    final r = await _t.send(
      'POST',
      '/v1/auth/otp/request',
      body: {'phone': phone},
    ) as Map<String, dynamic>;
    return r['devCode'] as String?;
  }

  /// Verifies the OTP and stores the tokens (in the session when there is one).
  Future<String> verifyOtp(String phone, String code) async {
    final r = await _t.send(
      'POST',
      '/v1/auth/otp/verify',
      body: {'phone': phone, 'code': code},
    ) as Map<String, dynamic>;
    final access = r['accessToken'] as String;
    final refresh = r['refreshToken'] as String?;
    final sm = _t.session;
    if (sm != null && refresh != null) {
      await sm.setTokens(
        tokensFromJson({...r, 'refreshToken': refresh}, sm.now()),
      );
    } else {
      _t.token = access;
    }
    return access;
  }

  Future<void> logout() async {
    await _t.send('POST', '/v1/auth/logout');
  }

  Future<void> updateProfile(Map<String, dynamic> patch) async {
    await _t.send('PATCH', '/v1/me', body: patch);
  }

  Future<void> acceptConsent(String kind, String version) async {
    await _t.send(
      'POST',
      '/v1/me/consents',
      body: {'kind': kind, 'version': version},
    );
  }

  Future<void> registerDevice(
    String deviceId,
    Map<String, dynamic> body,
  ) async {
    await _t.send('PUT', '/v1/me/devices/$deviceId', body: body);
  }

  Future<void> removeDevice(String deviceId) async {
    await _t.send('DELETE', '/v1/me/devices/$deviceId');
  }
}
