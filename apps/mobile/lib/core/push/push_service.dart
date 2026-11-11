import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';

/// A push payload. Every value is a string (FCM data keys, T-MOB-34 contract):
/// `type`, `id`, `familyId`, `title`, `body`, `speech` plus per-type keys
/// (nudge `from, phraseId, phrase, intensity`; msg `conversationId, kind`; call `callId, from, kind`).
class PushMessage {
  const PushMessage(this.data);

  final Map<String, String> data;

  String get type => data['type'] ?? '';
  String? get id => data['id'];
  String? get familyId => data['familyId'];
  String get title => data['title'] ?? '';
  String get body => data['body'] ?? '';
  String? get speech => data['speech'];

  factory PushMessage.fromRemote(RemoteMessage m) {
    final data = {
      for (final e in m.data.entries) e.key: '${e.value}',
    };
    final n = m.notification;
    if (n != null) {
      if (n.title != null) data.putIfAbsent('title', () => n.title!);
      if (n.body != null) data.putIfAbsent('body', () => n.body!);
    }
    return PushMessage(data);
  }
}

/// Where push comes from. [FcmPushService] in the app, [FakePushService] in tests and in builds
/// without Firebase config.
abstract class PushService {
  Future<void> init();

  /// Messages that arrive while the app is open.
  Stream<PushMessage> get foreground;

  /// Notification taps (app in background, or started from a notification).
  Stream<PushMessage> get opened;

  /// The device token, or null when push is unavailable.
  Future<String?> token();
  Stream<String> get tokenRefresh;
}

class FcmPushService implements PushService {
  FcmPushService([FirebaseMessaging? messaging])
      : _fm = messaging ?? FirebaseMessaging.instance;

  final FirebaseMessaging _fm;

  @override
  Future<void> init() async {
    await _fm.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );
  }

  @override
  Stream<PushMessage> get foreground =>
      FirebaseMessaging.onMessage.map(PushMessage.fromRemote);

  @override
  Stream<PushMessage> get opened async* {
    final first = await _fm.getInitialMessage();
    if (first != null) yield PushMessage.fromRemote(first);
    yield* FirebaseMessaging.onMessageOpenedApp.map(PushMessage.fromRemote);
  }

  @override
  Future<String?> token() async {
    try {
      return await _fm.getToken();
    } catch (_) {
      return null;
    }
  }

  @override
  Stream<String> get tokenRefresh => _fm.onTokenRefresh;
}

class FakePushService implements PushService {
  FakePushService({String? token}) : _token = token;

  String? _token;
  final _fg = StreamController<PushMessage>.broadcast();
  final _open = StreamController<PushMessage>.broadcast();
  final _refresh = StreamController<String>.broadcast();

  @override
  Future<void> init() async {}

  /// Test helper: a message arrives while the app is open.
  void emit(PushMessage m) => _fg.add(m);

  /// Test helper: the user taps a notification.
  void tap(PushMessage m) => _open.add(m);

  /// Test helper: FCM issues a new token.
  void refreshToken(String t) {
    _token = t;
    _refresh.add(t);
  }

  @override
  Stream<PushMessage> get foreground => _fg.stream;

  @override
  Stream<PushMessage> get opened => _open.stream;

  @override
  Future<String?> token() async => _token;

  @override
  Stream<String> get tokenRefresh => _refresh.stream;
}
