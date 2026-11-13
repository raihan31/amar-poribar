// ignore_for_file: file_names
import 'package:amar_poribar/features/home/state/home_providers.dart';
import 'package:amar_poribar/features/notifications/data/inbox_repository.dart';
import 'package:amar_poribar/features/notifications/state/inbox_providers.dart';
import 'package:amar_poribar/features/notifications/ui/notifications_screen.dart';

import 'golden_config.dart';

/// Board: Notifications.dc.html. 12:00 UTC = 18:00 in Dhaka.
InboxItem _i(
  String id,
  String kind,
  String title,
  String body,
  String at, {
  String? readAt,
}) =>
    InboxItem(
      id: id,
      kind: kind,
      title: title,
      body: body,
      createdAt: at,
      readAt: readAt,
    );

void main() {
  goldenScreen(
    'F3_notifications',
    const NotificationsScreen(),
    overrides: [
      homeClockProvider.overrideWithValue(() => DateTime.utc(2026, 11, 9, 12)),
      notificationPreferencesProvider.overrideWith((ref) async => null),
      inboxRepositoryProvider.overrideWithValue(
        FakeInboxRepository(
          items: [
            _i(
              '1',
              'budget',
              'বাজেট',
              'বাজারের বাজেটের ৮০% শেষ',
              '2026-11-09T11:30:00Z',
            ),
            _i(
              '2',
              'invite',
              'আমন্ত্রণ',
              '০১৭৯৮… যোগ দিতে চায়',
              '2026-11-09T10:00:00Z',
            ),
            _i(
              '3',
              'reminder',
              'রোজকার মনে করানো',
              'আজকের খরচ লিখেছেন?',
              '2026-11-09T03:00:00Z',
            ),
            _i(
              '4',
              'bill',
              'বিল মনে করানো',
              'বাসা ভাড়া ৫ তারিখ · ৳ ১২,০০০',
              '2026-11-08T05:00:00Z',
              readAt: '2026-11-08T06:00:00Z',
            ),
            _i(
              '5',
              'nudge',
              'কম্পন',
              'আব্বু বলছেন: খেতে আসুন',
              '2026-11-08T04:00:00Z',
              readAt: '2026-11-08T06:00:00Z',
            ),
          ],
        ),
      ),
    ],
  );
}
