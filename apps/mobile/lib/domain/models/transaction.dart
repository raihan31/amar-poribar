import 'enums.dart';

class TransactionRecord {
  final String id;
  final String deviceId; // ID of the device that created it
  final double amount;
  final String categoryId;
  final TransactionType type;
  final String note;
  final DateTime timestamp;
  final String? bankMessageId; // Reference to bank SMS if created from it
  
  // CRDT specific fields
  final int isDeleted; 
  final String hlc;

  TransactionRecord({
    required this.id,
    required this.deviceId,
    required this.amount,
    required this.categoryId,
    required this.type,
    required this.note,
    required this.timestamp,
    this.bankMessageId,
    this.isDeleted = 0,
    required this.hlc,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'device_id': deviceId,
      'amount': amount,
      'category_id': categoryId,
      'type': type.name,
      'note': note,
      'timestamp': timestamp.toIso8601String(),
      'bank_message_id': bankMessageId,
      'is_deleted': isDeleted,
      'hlc': hlc,
    };
  }

  factory TransactionRecord.fromMap(Map<String, dynamic> map) {
    return TransactionRecord(
      id: map['id'] as String,
      deviceId: map['device_id'] as String,
      amount: (map['amount'] as num).toDouble(),
      categoryId: map['category_id'] as String,
      type: TransactionType.fromString(map['type']),
      note: map['note'] as String,
      timestamp: DateTime.parse(map['timestamp']),
      bankMessageId: map['bank_message_id'] as String?,
      isDeleted: map['is_deleted'] as int,
      hlc: map['hlc'] as String,
    );
  }
}
