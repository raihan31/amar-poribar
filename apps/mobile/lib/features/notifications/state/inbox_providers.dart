import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/api/api_providers.dart';
import '../../../domain/models/api/engage.dart';
import '../../../presentation/providers/providers.dart';
import '../data/inbox_repository.dart';

final inboxRepositoryProvider = Provider<InboxRepository>(
  (ref) => ApiInboxRepository(
    ref.watch(localStoreProvider).db,
    ref.watch(notificationApiProvider),
  ),
);

final inboxItemsProvider = StreamProvider<List<InboxItem>>(
  (ref) => ref.watch(inboxRepositoryProvider).watch(),
);

/// Unread items, for the bell on Home.
final unreadCountProvider = StreamProvider<int>(
  (ref) => ref.watch(inboxRepositoryProvider).unreadCount,
);

/// Pause between two items when listening to all (T-MOB-35).
final listenAllPauseProvider =
    Provider<Duration>((ref) => const Duration(milliseconds: 700));

/// The user's notification preferences; null when they cannot be fetched (offline, signed out).
final notificationPreferencesProvider =
    FutureProvider<Preferences?>((ref) async {
  try {
    return await ref.watch(notificationApiProvider).preferences();
  } catch (_) {
    return null;
  }
});

({int h, int m}) _hm(String? s, int dh, int dm) {
  final p = s?.split(':');
  final h = p == null || p.length != 2 ? null : int.tryParse(p[0]);
  final m = p == null || p.length != 2 ? null : int.tryParse(p[1]);
  return (h: h ?? dh, m: m ?? dm);
}

/// Whether [nowDhaka] (wall-clock) falls inside quiet hours (default 22:00 to 06:00, FR-NOTIF-05).
bool inQuietHours(DateTime nowDhaka, String? start, String? end) {
  final s = _hm(start, 22, 0);
  final e = _hm(end, 6, 0);
  final t = nowDhaka.hour * 60 + nowDhaka.minute;
  final a = s.h * 60 + s.m;
  final b = e.h * 60 + e.m;
  if (a == b) return false;
  return a < b ? (t >= a && t < b) : (t >= a || t < b);
}
