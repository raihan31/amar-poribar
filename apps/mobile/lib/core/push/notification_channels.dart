import 'dart:typed_data';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../../l10n/gen/app_localizations.dart';

/// Name and description of each channel, from the ARB keys `push_channel_*`.
class ChannelTexts {
  const ChannelTexts({
    required this.nudge,
    required this.chat,
    required this.alerts,
    required this.reminders,
    required this.calls,
  });

  /// (name, description)
  final (String, String) nudge, chat, alerts, reminders, calls;

  factory ChannelTexts.from(AppLocalizations l10n) => ChannelTexts(
        nudge: (l10n.push_channel_nudge_name, l10n.push_channel_nudge_desc),
        chat: (l10n.push_channel_chat_name, l10n.push_channel_chat_desc),
        alerts: (l10n.push_channel_alerts_name, l10n.push_channel_alerts_desc),
        reminders: (
          l10n.push_channel_reminders_name,
          l10n.push_channel_reminders_desc
        ),
        calls: (l10n.push_channel_calls_name, l10n.push_channel_calls_desc),
      );
}

/// Channel ids (also the `android_channel_id` the server sends).
class ChannelIds {
  ChannelIds._();
  static const nudge = 'nudge';
  static const chat = 'chat';
  static const alerts = 'alerts';
  static const reminders = 'reminders';
  static const calls = 'calls';
}

/// Creates the five channels. Creating an existing channel is a no-op, so this is safe on every
/// launch. [android] is null off Android.
Future<void> createNotificationChannels(
  AndroidFlutterLocalNotificationsPlugin? android,
  ChannelTexts t,
) async {
  if (android == null) return;
  final channels = [
    AndroidNotificationChannel(
      ChannelIds.nudge,
      t.nudge.$1,
      description: t.nudge.$2,
      importance: Importance.max,
      playSound: false,
      enableVibration: true,
      vibrationPattern: Int64List.fromList([0, 300, 150, 300]),
    ),
    AndroidNotificationChannel(
      ChannelIds.chat,
      t.chat.$1,
      description: t.chat.$2,
      importance: Importance.high,
    ),
    AndroidNotificationChannel(
      ChannelIds.alerts,
      t.alerts.$1,
      description: t.alerts.$2,
      importance: Importance.high,
    ),
    AndroidNotificationChannel(
      ChannelIds.reminders,
      t.reminders.$1,
      description: t.reminders.$2,
    ),
    AndroidNotificationChannel(
      ChannelIds.calls,
      t.calls.$1,
      description: t.calls.$2,
      importance: Importance.max,
      playSound: true,
      // Default ringtone sound; the full-screen intent comes from the notification itself.
      enableVibration: true,
      vibrationPattern: Int64List.fromList([0, 800, 400, 800]),
    ),
  ];
  for (final c in channels) {
    await android.createNotificationChannel(c);
  }
}
