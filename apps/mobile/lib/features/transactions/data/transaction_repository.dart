import '../../../data/database/database.dart';
import '../../../data/database/local_store.dart'
    show RestoreWindowClosed, TxnPage;
import '../domain/txn_query.dart';

export '../../../data/database/local_store.dart'
    show RestoreWindowClosed, TxnPage;

abstract class TransactionRepository {
  Future<TxnPage> page(TxnQuery q, {String? cursor, int limit = 50});
  Stream<List<Transaction>> watch(TxnQuery q);
  Future<Transaction?> byId(String id);
  Future<String> add({
    required String familyId,
    required String type,
    required int amountPaisa,
    int feePaisa = 0,
    DateTime? occurredAt,
    String? categoryId,
    String? accountId,
    String? note,
    String? counterparty,
    String source = 'manual',
    bool isPrivate = false,
    String? splitGroupId,
    String? attachmentKey,
    String? paidByUserId,
    String? createdBy,
  });

  /// Edits an entry in place with a new HLC (null arguments leave a field unchanged; an empty
  /// [note] clears the note).
  Future<void> update(
    String id, {
    String? type,
    int? amountPaisa,
    int? feePaisa,
    DateTime? occurredAt,
    String? categoryId,
    String? accountId,
    String? note,
    bool? isPrivate,
    String? paidByUserId,
  });
  Future<void> delete(String id);

  /// Throws [RestoreWindowClosed] when the entry was deleted 30 days ago or more.
  Future<void> restore(String id);
  Future<int> purgeOldTombstones();
}

/// Label of a day section in Asia/Dhaka: "আজ", "গতকাল", else "১০ নভেম্বর".
String dayHeader(String occurredAtIso, DateTime now) {
  const dhaka = Duration(hours: 6);
  DateTime day(DateTime d) {
    final l = d.toUtc().add(dhaka);
    return DateTime.utc(l.year, l.month, l.day);
  }

  final d = day(DateTime.parse(occurredAtIso));
  final today = day(now);
  final diff = today.difference(d).inDays;
  if (diff == 0) return 'আজ';
  if (diff == 1) return 'গতকাল';
  const digits = '০১২৩৪৫৬৭৮৯';
  final n = '${d.day}'.split('').map((c) => digits[int.parse(c)]).join();
  const months = [
    'জানুয়ারি',
    'ফেব্রুয়ারি',
    'মার্চ',
    'এপ্রিল',
    'মে',
    'জুন',
    'জুলাই',
    'আগস্ট',
    'সেপ্টেম্বর',
    'অক্টোবর',
    'নভেম্বর',
    'ডিসেম্বর',
  ];
  return '$n ${months[d.month - 1]}';
}
