import 'dart:async';

import 'push_service.dart';

/// Keeps the server's device row in step with this phone (FR-AUTH-11, FR-NOTIF-06):
/// `PUT /v1/me/devices/:deviceId` on sign-in and token refresh, `DELETE` on sign-out.
/// Network failures are swallowed; the next sign-in or refresh retries.
class DeviceRegistrar {
  DeviceRegistrar({
    required this.push,
    required this.deviceId,
    required this.appVersion,
    required this.locale,
    required this.register,
    required this.remove,
  });

  final PushService push;
  final Future<String> Function() deviceId;
  final String appVersion;
  final String Function() locale;
  final Future<void> Function(String id, Map<String, dynamic> body) register;
  final Future<void> Function(String id) remove;

  StreamSubscription<String>? _sub;

  Future<void> onSignedIn() async {
    await _sub?.cancel();
    _sub = push.tokenRefresh.listen((t) => _put(t));
    final t = await push.token();
    if (t != null) await _put(t);
  }

  Future<void> onSignedOut() async {
    await stop();
    try {
      await remove(await deviceId());
    } catch (_) {}
  }

  Future<void> stop() async {
    final s = _sub;
    _sub = null;
    await s?.cancel();
  }

  Future<void> _put(String token) async {
    try {
      await register(await deviceId(), {
        'platform': 'android',
        'fcmToken': token,
        'appVersion': appVersion,
        'locale': locale(),
      });
    } catch (_) {}
  }
}
