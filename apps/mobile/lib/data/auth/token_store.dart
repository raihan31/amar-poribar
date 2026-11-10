import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class Tokens {
  final String access;
  final String refresh;
  final DateTime accessExpiresAt;
  const Tokens({
    required this.access,
    required this.refresh,
    required this.accessExpiresAt,
  });
}

abstract class TokenStore {
  Future<Tokens?> read();
  Future<void> write(Tokens t);
  Future<void> clear();
}

/// Keychain / Keystore backed store. The device id survives [clear].
class SecureTokenStore implements TokenStore {
  static const accessKey = 'ap.access';
  static const refreshKey = 'ap.refresh';
  static const deviceIdKey = 'ap.deviceId';
  static const _expKey = 'ap.accessExp';

  final FlutterSecureStorage _s;
  SecureTokenStore([FlutterSecureStorage? storage])
      : _s = storage ?? const FlutterSecureStorage();

  @override
  Future<Tokens?> read() async {
    try {
      final a = await _s.read(key: accessKey);
      final r = await _s.read(key: refreshKey);
      final e = int.tryParse(await _s.read(key: _expKey) ?? '');
      if (a == null || r == null || e == null) return null;
      return Tokens(
        access: a,
        refresh: r,
        accessExpiresAt: DateTime.fromMillisecondsSinceEpoch(e, isUtc: true),
      );
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> write(Tokens t) async {
    await _s.write(key: accessKey, value: t.access);
    await _s.write(key: refreshKey, value: t.refresh);
    await _s.write(
      key: _expKey,
      value: t.accessExpiresAt.millisecondsSinceEpoch.toString(),
    );
  }

  @override
  Future<void> clear() async {
    try {
      await _s.delete(key: accessKey);
      await _s.delete(key: refreshKey);
      await _s.delete(key: _expKey);
    } catch (_) {}
  }

  Future<String?> deviceId() => _s.read(key: deviceIdKey);
  Future<void> writeDeviceId(String id) =>
      _s.write(key: deviceIdKey, value: id);
}

class MemoryTokenStore implements TokenStore {
  Tokens? _t;
  MemoryTokenStore([this._t]);

  @override
  Future<Tokens?> read() async => _t;
  @override
  Future<void> write(Tokens t) async => _t = t;
  @override
  Future<void> clear() async => _t = null;
}
