import 'enums.dart';

class Budget {
  final String id;
  final String roleOwnerId; // Applies specifically to a Role, or 'family' for global
  final String? categoryId; // Null implies total overall budget
  final double amount;
  final DateTime periodStart;
  final DateTime periodEnd;

  // CRDT specific fields
  final int isDeleted; 
  final String hlc;

  Budget({
    required this.id,
    required this.roleOwnerId,
    this.categoryId,
    required this.amount,
    required this.periodStart,
    required this.periodEnd,
    this.isDeleted = 0,
    required this.hlc,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'role_owner_id': roleOwnerId,
      'category_id': categoryId,
      'amount': amount,
      'period_start': periodStart.toIso8601String(),
      'period_end': periodEnd.toIso8601String(),
      'is_deleted': isDeleted,
      'hlc': hlc,
    };
  }

  factory Budget.fromMap(Map<String, dynamic> map) {
    return Budget(
      id: map['id'] as String,
      roleOwnerId: map['role_owner_id'] as String,
      categoryId: map['category_id'] as String?,
      amount: (map['amount'] as num).toDouble(),
      periodStart: DateTime.parse(map['period_start']),
      periodEnd: DateTime.parse(map['period_end']),
      isDeleted: map['is_deleted'] as int,
      hlc: map['hlc'] as String,
    );
  }
}
