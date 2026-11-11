import 'dart:async';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../core/l10n/locale_controller.dart';
import '../core/push/device_registrar.dart';
import '../core/push/notification_channels.dart';
import '../core/push/push_router.dart';
import '../core/push/push_service.dart';
import '../data/api/api_providers.dart';
import '../l10n/gen/app_localizations.dart';
import '../presentation/providers/auth_provider.dart';
import '../presentation/providers/providers.dart';
import 'router.dart';

const appVersion = String.fromEnvironment('APP_VERSION', defaultValue: '1.0.0');

/// `main.dart` overrides this with [FcmPushService] when Firebase started; otherwise no push.
final pushServiceProvider =
    Provider<PushService>((ref) => FakePushService());

/// Foreground messages go here. The inbox (T-MOB-35) and the vibration engine (T-MOB-42)
/// replace the default, which does nothing.
final foregroundPushHandlerProvider =
    Provider<void Function(PushMessage)>((ref) => (_) {});

final pushRouterProvider =
    Provider<PushRouter>((ref) => PushRouter(ref.read(deepLinkProvider)));

/// Stable id of this install, kept in `Meta('device_id')`.
final deviceIdProvider = Provider<Future<String> Function()>((ref) {
  return () async {
    final store = ref.read(localStoreProvider);
    var id = await store.getMeta('device_id');
    if (id == null) {
      id = const Uuid().v4();
      await store.setMeta('device_id', id);
    }
    return id;
  };
});

final deviceRegistrarProvider = Provider<DeviceRegistrar>((ref) {
  final api = ref.watch(authApiProvider);
  final r = DeviceRegistrar(
    push: ref.watch(pushServiceProvider),
    deviceId: ref.watch(deviceIdProvider),
    appVersion: appVersion,
    locale: () => ref.read(localeProvider).languageCode,
    register: api.registerDevice,
    remove: api.removeDevice,
  );
  ref.onDispose(r.stop);
  return r;
});

/// Starts push for the running app: channels, device registration on sign-in/out,
/// foreground messages and notification taps. Watch it once from the app widget.
final pushWiringProvider = Provider<void>((ref) {
  final push = ref.watch(pushServiceProvider);
  final subs = <StreamSubscription<Object?>>[];
  ref.onDispose(() {
    for (final s in subs) {
      s.cancel();
    }
  });

  Future<void> start() async {
    try {
      await push.init();
      final android = FlutterLocalNotificationsPlugin()
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();
      final l10n = lookupAppLocalizations(ref.read(localeProvider));
      await createNotificationChannels(android, ChannelTexts.from(l10n));
    } catch (_) {
      // Push is optional: the app works without it.
    }
    subs.add(
      push.foreground.listen((m) => ref.read(foregroundPushHandlerProvider)(m)),
    );
    subs.add(push.opened.listen((m) => ref.read(pushRouterProvider).open(m)));
  }

  unawaited(start());

  final registrar = ref.read(deviceRegistrarProvider);
  void sync(bool? was, bool now) {
    if (now && was != true) unawaited(registrar.onSignedIn());
    if (!now && was == true) unawaited(registrar.onSignedOut());
  }

  sync(null, ref.read(authProvider).signedIn);
  ref.listen<AuthState>(
    authProvider,
    (prev, next) => sync(prev?.signedIn, next.signedIn),
  );
});
