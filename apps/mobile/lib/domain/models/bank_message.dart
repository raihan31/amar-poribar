import 'enums.dart';

class BankMessage {
  final String id;
  final String rawText;
  final String sender;
  final BankMessageStatus status;
  final double? detectedAmount;
  final TransactionType? detectedType;
  final DateTime receivedAt;

  // CRDT specific
  final int isDeleted; 
  final String hlc;

  BankMessage({
    required this.id,
    required this.rawText,
    required this.sender,
    this.status = BankMessageStatus.pending,
    this.detectedAmount,
    this.detectedType,
    required this.receivedAt,
    this.isDeleted = 0,
    required this.hlc,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'raw_text': rawText,
      'sender': sender,
      'status': status.name,
      'detected_amount': detectedAmount,
      'detected_type': detectedType?.name,
      'received_at': receivedAt.toIso8601String(),
      'is_deleted': isDeleted,
      'hlc': hlc,
    };
  }

  factory BankMessage.fromMap(Map<String, dynamic> map) {
    return BankMessage(
      id: map['id'] as String,
      rawText: map['raw_text'] as String,
      sender: map['sender'] as String,
      status: BankMessageStatus.fromString(map['status']),
      detectedAmount: map['detected_amount'] == null ? null : (map['detected_amount'] as num).toDouble(),
      detectedType: map['detected_type'] == null ? null : TransactionType.fromString(map['detected_type']),
      receivedAt: DateTime.parse(map['received_at']),
      isDeleted: map['is_deleted'] as int,
      hlc: map['hlc'] as String,
    );
  }
}
