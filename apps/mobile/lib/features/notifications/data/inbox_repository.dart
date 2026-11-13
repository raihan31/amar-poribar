import 'dart:async';
import 'dart:convert';

import 'package:drift/drift.dart';

import '../../../data/api/notification_api.dart';
import '../../../data/database/database.dart';
import '../../../domain/models/api/engage.dart';

export '../../../domain/models/api/engage.dart' show InboxItem;

/// The notification inbox (FR-NOTIF-04): the list, what is unread, and the server's 90-day history.
abstract class InboxRepository {
  /// Newest first.
  Stream<List<InboxItem>> watch();

  /// Number of unread items.
  Stream<int> get unreadCount;

  /// Fetches the last 90 days from the server (`GET /v1/inbox?cursor=`).
  Future<void> refresh();

  /// Adds an item received while the app is open (foreground push).
  Future<void> put(InboxItem item);

  /// Marks items read here at once and on the server (`POST /v1/inbox/read`).
  Future<void> markRead(List<String> ids);

  /// Removes everything here and on the server (`DELETE /v1/inbox`).
  Future<void> clear();
}

const inboxKeepDays = 90;

/// Local cache in the `inbox_items` table, filled from the API.
class ApiInboxRepository implements InboxRepository {
  ApiInboxRepository(this._db, this._api, {DateTime Function()? clock})
      : _clock = clock ?? DateTime.now;

  final AppDatabase _db;
  final NotificationApi _api;
  final DateTime Function() _clock;

  InboxItem _toModel(InboxRow r) => InboxItem(
        id: r.id,
        kind: r.kind,
        title: r.title,
        body: r.body,
        speechText: r.speechText,
        data: (jsonDecode(r.dataJson) as Map).cast<String, dynamic>(),
        createdAt: r.createdAt,
        readAt: r.readAt,
      );

  InboxItemsCompanion _toRow(InboxItem i) => InboxItemsCompanion.insert(
        id: i.id,
        kind: i.kind,
        title: i.title,
        body: i.body,
        speechText: Value(i.speechText),
        dataJson: Value(jsonEncode(i.data ?? const {})),
        createdAt: i.createdAt,
        readAt: Value(i.readAt),
      );

  @override
  Stream<List<InboxItem>> watch() {
    final q = _db.select(_db.inboxItems)
      ..orderBy([(t) => OrderingTerm.desc(t.createdAt)]);
    return q.watch().map((rows) => rows.map(_toModel).toList());
  }

  @override
  Stream<int> get unreadCount {
    final count = _db.inboxItems.id.count();
    final q = _db.selectOnly(_db.inboxItems)
      ..addColumns([count])
      ..where(_db.inboxItems.readAt.isNull());
    return q.watchSingle().map((r) => r.read(count) ?? 0);
  }

  @override
  Future<void> refresh() async {
    final cutoff =
        _clock().toUtc().subtract(const Duration(days: inboxKeepDays));
    String? cursor;
    do {
      final page = await _api.inbox(cursor: cursor);
      final fresh = page.items
          .where((i) => !DateTime.parse(i.createdAt).toUtc().isBefore(cutoff))
          .toList();
      await _db.batch(
        (b) => b.insertAllOnConflictUpdate(_db.inboxItems, fresh.map(_toRow)),
      );
      // Pages are newest first: stop once a page reaches into old items.
      cursor = fresh.length < page.items.length ? null : page.nextCursor;
    } while (cursor != null);
    await (_db.delete(_db.inboxItems)
          ..where(
            (t) => t.createdAt.isSmallerThanValue(cutoff.toIso8601String()),
          ))
        .go();
  }

  @override
  Future<void> put(InboxItem item) =>
      _db.into(_db.inboxItems).insertOnConflictUpdate(_toRow(item));

  @override
  Future<void> markRead(List<String> ids) async {
    if (ids.isEmpty) return;
    final now = _clock().toUtc().toIso8601String();
    await (_db.update(_db.inboxItems)
          ..where((t) => t.id.isIn(ids) & t.readAt.isNull()))
        .write(InboxItemsCompanion(readAt: Value(now)));
    try {
      await _api.markRead(ids);
    } catch (_) {
      // Offline: the item is already read here; the server catches up on the next refresh.
    }
  }

  @override
  Future<void> clear() async {
    await _db.delete(_db.inboxItems).go();
    try {
      await _api.clearInbox();
    } catch (_) {}
  }
}

/// In-memory inbox for tests and previews.
class FakeInboxRepository implements InboxRepository {
  FakeInboxRepository({
    List<InboxItem> items = const [],
    DateTime Function()? clock,
  })  : _items = [...items],
        _clock = clock ?? DateTime.now {
    _emit();
  }

  final DateTime Function() _clock;
  List<InboxItem> _items;
  final _list = StreamController<List<InboxItem>>.broadcast();

  /// Items the next [refresh] adds, as if they came from the server.
  final List<InboxItem> serverItems = [];

  /// Ids passed to [markRead], in order.
  final List<String> markedRead = [];
  int refreshCount = 0;
  int clearCount = 0;

  List<InboxItem> get items => List.unmodifiable(_items);

  void _emit() {
    _items.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    _list.add(List.of(_items));
  }

  @override
  Stream<List<InboxItem>> watch() async* {
    yield List.of(_items);
    yield* _list.stream;
  }

  int get _unread => _items.where((i) => i.readAt == null).length;

  @override
  Stream<int> get unreadCount async* {
    yield _unread;
    yield* _list.stream.map((_) => _unread);
  }

  @override
  Future<void> refresh() async {
    refreshCount++;
    for (final s in serverItems) {
      _items.removeWhere((i) => i.id == s.id);
      _items.add(s);
    }
    _emit();
  }

  @override
  Future<void> put(InboxItem item) async {
    _items.removeWhere((i) => i.id == item.id);
    _items.add(item);
    _emit();
  }

  @override
  Future<void> markRead(List<String> ids) async {
    markedRead.addAll(ids);
    final now = _clock().toUtc().toIso8601String();
    _items = [
      for (final i in _items)
        if (ids.contains(i.id) && i.readAt == null)
          InboxItem(
            id: i.id,
            kind: i.kind,
            title: i.title,
            body: i.body,
            speechText: i.speechText,
            data: i.data,
            createdAt: i.createdAt,
            readAt: now,
          )
        else
          i,
    ];
    _emit();
  }

  @override
  Future<void> clear() async {
    clearCount++;
    _items = [];
    _emit();
  }
}
