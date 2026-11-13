import 'package:amar_poribar/features/home/state/home_providers.dart';
import 'package:amar_poribar/features/notifications/data/inbox_repository.dart';
import 'package:amar_poribar/features/notifications/state/inbox_providers.dart';
import 'package:amar_poribar/features/notifications/ui/notifications_screen.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:amar_poribar/ui/listen_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../../helpers/fake_voice_service.dart';
import '../../helpers/pump_app.dart';

// 12:00 UTC = 18:00 in Dhaka.
final _now = DateTime.utc(2026, 11, 9, 12);

InboxItem _item(
  String id,
  String kind,
  String title,
  String body, {
  String? speech,
  String? readAt,
  String createdAt = '2026-11-09T05:00:00Z',
  Map<String, dynamic>? data,
}) =>
    InboxItem(
      id: id,
      kind: kind,
      title: title,
      body: body,
      speechText: speech,
      data: data,
      createdAt: createdAt,
      readAt: readAt,
    );

FakeInboxRepository _repo() => FakeInboxRepository(
      clock: () => _now,
      items: [
        _item(
          'a',
          'budget',
          'বাজেট',
          'বাজারের বাজেটের ৮০% শেষ',
          speech: 'বাজারের বাজেট আশি শতাংশ শেষ',
          createdAt: '2026-11-09T11:00:00Z',
        ),
        _item(
          'b',
          'reminder',
          'রোজকার মনে করানো',
          'আজকের খরচ লিখেছেন?',
          createdAt: '2026-11-09T10:00:00Z',
        ),
        _item(
          'c',
          'nudge',
          'কম্পন',
          'আব্বু বলছেন: খেতে আসুন',
          readAt: '2026-11-08T10:00:00Z',
          createdAt: '2026-11-08T10:00:00Z',
          data: {'id': 'n1'},
        ),
      ],
    );

List<Override> _over(FakeInboxRepository r) => [
      inboxRepositoryProvider.overrideWithValue(r),
      homeClockProvider.overrideWithValue(() => _now),
      listenAllPauseProvider.overrideWithValue(Duration.zero),
      notificationPreferencesProvider.overrideWith((ref) async => null),
    ];

Future<void> _settle(WidgetTester t) async {
  await t.pump();
  await t.pump(const Duration(milliseconds: 50));
  await t.pump(const Duration(milliseconds: 50));
}

void main() {
  testWidgets('unread rows have a dot and a bold title, read rows do not',
      (t) async {
    await pumpApp(t, const NotificationsScreen(), overrides: _over(_repo()));
    await _settle(t);

    expect(find.byKey(const ValueKey('unread-dot')), findsNWidgets(2));
    final unread = t.widget<Text>(find.text('বাজেট'));
    final read = t.widget<Text>(find.text('কম্পন'));
    expect(unread.style!.fontWeight, FontWeight.w700);
    expect(read.style!.fontWeight, isNot(FontWeight.w700));
    expect(find.text('গতকাল'), findsOneWidget);
    expect(find.text('আজ সন্ধ্যায়'), findsNothing);
  });

  testWidgets('a row listen button speaks speechText, else title and body',
      (t) async {
    await pumpApp(t, const NotificationsScreen(), overrides: _over(_repo()));
    await _settle(t);
    final voice =
        appContainer(t).read(voiceServiceProvider) as FakeVoiceService;

    await t.tap(find.byType(ListenButton).at(0));
    await _settle(t);
    await t.tap(find.byType(ListenButton).at(1));
    await _settle(t);

    expect(voice.spoken, [
      'বাজারের বাজেট আশি শতাংশ শেষ',
      'রোজকার মনে করানো। আজকের খরচ লিখেছেন?',
    ]);
  });

  testWidgets('"সব শুনুন" speaks unread items in order and marks them read',
      (t) async {
    final repo = _repo();
    await pumpApp(t, const NotificationsScreen(), overrides: _over(repo));
    await _settle(t);
    final voice =
        appContainer(t).read(voiceServiceProvider) as FakeVoiceService;

    await t.tap(find.text('সব শুনুন'));
    await t.pump();
    await t.pump(const Duration(milliseconds: 800));
    await t.pump(const Duration(milliseconds: 800));
    await _settle(t);

    expect(voice.spoken, [
      'বাজারের বাজেট আশি শতাংশ শেষ',
      'রোজকার মনে করানো। আজকের খরচ লিখেছেন?',
    ]);
    expect(repo.markedRead, ['a', 'b']);
    expect(find.byKey(const ValueKey('unread-dot')), findsNothing);
    // Nothing left to listen to.
    expect(find.text('সব শুনুন'), findsNothing);
  });

  testWidgets('tapping an item marks it read and opens its route', (t) async {
    final repo = _repo();
    final router = GoRouter(
      initialLocation: '/notifications',
      routes: [
        GoRoute(
          path: '/notifications',
          builder: (_, __) => const NotificationsScreen(),
        ),
        GoRoute(
          path: '/budget',
          builder: (_, __) => const Scaffold(body: Text('BUDGET PAGE')),
        ),
      ],
    );
    await pumpApp(t, const SizedBox(), overrides: _over(repo), router: router);
    await _settle(t);

    await t.tap(find.text('বাজেট'));
    await _settle(t);

    expect(repo.markedRead, ['a']);
    expect(find.text('BUDGET PAGE'), findsOneWidget);
  });

  testWidgets('quiet hours show a note card; daytime does not', (t) async {
    // 17:00 UTC = 23:00 Dhaka, inside the default 22:00 to 06:00.
    await pumpApp(
      t,
      const NotificationsScreen(),
      overrides: [
        ..._over(_repo()),
        homeClockProvider
            .overrideWithValue(() => DateTime.utc(2026, 11, 9, 17)),
      ],
    );
    await _settle(t);
    expect(find.textContaining('চুপ সময়'), findsOneWidget);
  });

  testWidgets('no quiet note at 18:00 Dhaka', (t) async {
    await pumpApp(t, const NotificationsScreen(), overrides: _over(_repo()));
    await _settle(t);
    expect(find.textContaining('চুপ সময়'), findsNothing);
  });

  test('inQuietHours handles ranges that cross midnight', () {
    expect(inQuietHours(DateTime.utc(2026, 1, 1, 23), null, null), isTrue);
    expect(inQuietHours(DateTime.utc(2026, 1, 1, 5, 59), null, null), isTrue);
    expect(inQuietHours(DateTime.utc(2026, 1, 1, 6), null, null), isFalse);
    expect(
      inQuietHours(DateTime.utc(2026, 1, 1, 12), '13:00', '15:00'),
      isFalse,
    );
    expect(
      inQuietHours(DateTime.utc(2026, 1, 1, 14), '13:00', '15:00'),
      isTrue,
    );
  });

  testWidgets('empty inbox shows the empty message', (t) async {
    await pumpApp(
      t,
      const NotificationsScreen(),
      overrides: _over(FakeInboxRepository()),
    );
    await _settle(t);
    expect(find.text('এখনো কোনো খবর নেই'), findsOneWidget);
  });
}
