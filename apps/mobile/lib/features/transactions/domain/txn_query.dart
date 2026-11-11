/// Filters for the local transaction list (T-MOB-24). All fields are optional except [familyId].
class TxnQuery {
  final String familyId;

  /// `YYYY-MM` in Asia/Dhaka.
  final String? month;
  final String? categoryId;
  final String? paidByUserId;
  final String? accountId;
  final String? type;
  final String? source;

  /// Matched against note and counterparty.
  final String? text;

  /// The signed-in user. Private rows are returned only when they were created by this user (FR-TXN-05).
  final String? viewerUserId;

  const TxnQuery({
    required this.familyId,
    this.month,
    this.categoryId,
    this.paidByUserId,
    this.accountId,
    this.type,
    this.source,
    this.text,
    this.viewerUserId,
  });

  /// True when private rows created by [myUserId] may be shown to the viewer.
  bool includePrivateOf(String myUserId) => viewerUserId == myUserId;

  /// UTC bounds `[start, end)` of [month] in Asia/Dhaka (UTC+6, no daylight saving).
  ({DateTime start, DateTime end})? get monthRange {
    final m = month;
    if (m == null) return null;
    final parts = m.split('-');
    final y = int.parse(parts[0]);
    final mo = int.parse(parts[1]);
    const dhaka = Duration(hours: 6);
    return (
      start: DateTime.utc(y, mo).subtract(dhaka),
      end: DateTime.utc(y, mo + 1).subtract(dhaka),
    );
  }
}
