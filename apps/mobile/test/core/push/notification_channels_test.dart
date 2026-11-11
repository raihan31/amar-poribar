import 'package:amar_poribar/core/push/notification_channels.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockAndroid extends Mock
    implements AndroidFlutterLocalNotificationsPlugin {}

class FakeChannel extends Fake implements AndroidNotificationChannel {}

const texts = ChannelTexts(
  nudge: ('কম্পন', 'd'),
  chat: ('কথা', 'd'),
  alerts: ('বাজেট সতর্কতা', 'd'),
  reminders: ('মনে করানো', 'd'),
  calls: ('ভিডিও কল', 'd'),
);

void main() {
  setUpAll(() => registerFallbackValue(FakeChannel()));

  test('creates the five channels with ids and importance', () async {
    final plugin = MockAndroid();
    when(() => plugin.createNotificationChannel(any()))
        .thenAnswer((_) async {});
    await createNotificationChannels(plugin, texts);
    final got = verify(() => plugin.createNotificationChannel(captureAny()))
        .captured
        .cast<AndroidNotificationChannel>();
    final byId = {for (final c in got) c.id: c};
    expect(byId.keys, {'nudge', 'chat', 'alerts', 'reminders', 'calls'});
    expect(byId['nudge']!.importance, Importance.max);
    expect(byId['nudge']!.name, 'কম্পন');
    expect(byId['nudge']!.playSound, isFalse);
    expect(byId['nudge']!.vibrationPattern!.toList(), [0, 300, 150, 300]);
    expect(byId['chat']!.importance, Importance.high);
    expect(byId['alerts']!.importance, Importance.high);
    expect(byId['reminders']!.importance, Importance.defaultImportance);
    expect(byId['calls']!.importance, Importance.max);
    expect(byId['calls']!.vibrationPattern!.toList(), [0, 800, 400, 800]);
    expect(byId['calls']!.playSound, isTrue);
  });

  test('a null platform plugin (non-Android) is a no-op', () async {
    await createNotificationChannels(null, texts);
  });
}
