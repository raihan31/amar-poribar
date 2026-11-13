import 'package:amar_poribar/features/notifications/state/reminder_scheduler.dart';
import 'package:flutter_test/flutter_test.dart';

class _Gateway implements ReminderGateway {
  final List<String> calls = [];

  @override
  Future<void> scheduleDaily({
    required int id,
    required String title,
    required String body,
    required int hour,
    required int minute,
  }) async =>
      calls.add('schedule $id $hour:$minute $title');

  @override
  Future<void> cancel(int id) async => calls.add('cancel $id');
}

void main() {
  late _Gateway g;
  late ReminderScheduler s;
  setUp(() {
    g = _Gateway();
    s = ReminderScheduler(g, title: 'মনে করানো', body: 'খরচ লিখেছেন?');
  });

  test('without push it schedules at 21:00 by default', () async {
    await s.sync(pushAvailable: false);
    expect(g.calls, ['schedule $reminderNotificationId 21:0 মনে করানো']);
  });

  test('uses the time the user chose', () async {
    await s.sync(pushAvailable: false, time: '08:30');
    expect(g.calls.single, contains('8:30'));
  });

  test('a bad time falls back to 21:00', () async {
    await s.sync(pushAvailable: false, time: 'soon');
    expect(g.calls.single, contains('21:0'));
  });

  test('with push it schedules nothing and cancels a leftover', () async {
    await s.sync(pushAvailable: true);
    expect(g.calls, ['cancel $reminderNotificationId']);
  });

  test('a reminder from the server cancels the local one', () async {
    await s.onServerReminder();
    expect(g.calls, ['cancel $reminderNotificationId']);
  });

  test('nextDailyAt is 21:00 Dhaka today or tomorrow', () {
    // 12:00 UTC = 18:00 Dhaka: today 21:00 Dhaka = 15:00 UTC.
    expect(
      nextDailyAt(DateTime.utc(2026, 11, 9, 12), 21, 0),
      DateTime.utc(2026, 11, 9, 15),
    );
    // 16:00 UTC = 22:00 Dhaka: tomorrow.
    expect(
      nextDailyAt(DateTime.utc(2026, 11, 9, 16), 21, 0),
      DateTime.utc(2026, 11, 10, 15),
    );
  });
}
