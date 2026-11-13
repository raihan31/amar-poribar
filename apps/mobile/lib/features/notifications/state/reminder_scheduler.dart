import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import '../../../core/push/notification_channels.dart';

/// Default time of the daily "log your spending" reminder (FR-NOT-02), Asia/Dhaka.
const defaultReminderTime = '21:00';
const reminderNotificationId = 2100;

/// Parses "HH:mm"; falls back to 21:00.
({int hour, int minute}) parseReminderTime(String? hhmm) {
  final m = RegExp(r'^(\d{1,2}):(\d{2})$').firstMatch(hhmm ?? '');
  if (m != null) {
    final h = int.parse(m[1]!);
    final min = int.parse(m[2]!);
    if (h < 24 && min < 60) return (hour: h, minute: min);
  }
  return (hour: 21, minute: 0);
}

/// The next moment (UTC) at [hour]:[minute] Asia/Dhaka (UTC+6, no daylight saving) after [nowUtc].
DateTime nextDailyAt(DateTime nowUtc, int hour, int minute) {
  final dhaka = nowUtc.toUtc().add(const Duration(hours: 6));
  var at = DateTime.utc(dhaka.year, dhaka.month, dhaka.day, hour, minute);
  if (!at.isAfter(dhaka)) at = at.add(const Duration(days: 1));
  return at.subtract(const Duration(hours: 6));
}

/// What the scheduler needs from the phone. Tests use a fake.
abstract class ReminderGateway {
  Future<void> scheduleDaily({
    required int id,
    required String title,
    required String body,
    required int hour,
    required int minute,
  });

  Future<void> cancel(int id);
}

/// [ReminderGateway] on top of `flutter_local_notifications`, channel `reminders`.
class LocalNotificationsGateway implements ReminderGateway {
  LocalNotificationsGateway([FlutterLocalNotificationsPlugin? plugin])
      : _plugin = plugin ?? FlutterLocalNotificationsPlugin();

  final FlutterLocalNotificationsPlugin _plugin;
  static bool _zonesReady = false;

  @override
  Future<void> scheduleDaily({
    required int id,
    required String title,
    required String body,
    required int hour,
    required int minute,
  }) async {
    if (!_zonesReady) {
      tzdata.initializeTimeZones();
      _zonesReady = true;
    }
    final dhaka = tz.getLocation('Asia/Dhaka');
    final when = tz.TZDateTime.from(
      nextDailyAt(DateTime.now().toUtc(), hour, minute),
      dhaka,
    );
    await _plugin.zonedSchedule(
      id,
      title,
      body,
      when,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          ChannelIds.reminders,
          ChannelIds.reminders,
        ),
      ),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      uiLocalNotificationDateInterpretation:
          UILocalNotificationDateInterpretation.absoluteTime,
      matchDateTimeComponents: DateTimeComponents.time,
      payload: 'reminder',
    );
  }

  @override
  Future<void> cancel(int id) => _plugin.cancel(id);
}

/// Local fallback for the daily reminder (FR-NOT-02): used only when push is unavailable
/// (no FCM token), and cancelled as soon as the server sends the reminder itself.
class ReminderScheduler {
  ReminderScheduler(this.gateway, {required this.title, required this.body});

  final ReminderGateway gateway;
  final String title;
  final String body;

  /// Call at start-up and whenever the token or the reminder time changes.
  Future<void> sync({required bool pushAvailable, String? time}) async {
    if (pushAvailable) return gateway.cancel(reminderNotificationId);
    final t = parseReminderTime(time);
    await gateway.scheduleDaily(
      id: reminderNotificationId,
      title: title,
      body: body,
      hour: t.hour,
      minute: t.minute,
    );
  }

  /// The server sent the reminder: the local one is no longer needed.
  Future<void> onServerReminder() => gateway.cancel(reminderNotificationId);
}
