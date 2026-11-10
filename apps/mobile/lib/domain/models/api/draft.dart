import '../../../core/money/money.dart';

/// A transaction proposed by the parser, waiting for the user to confirm (SRS FR-AI-05).
class TransactionDraft {
  final String type; // expense | income | transfer
  final int amountPaisa;
  final int feePaisa;
  final String occurredAt;
  final String? categoryKey;
  final String? accountType;
  final String note;
  final String? counterparty;
  final String? trxId;
  final String source;
  final double confidence;

  /// Set when this draft came from the offline queue; removing it from the queue is part of confirming it.
  final String? pendingId;

  const TransactionDraft({
    required this.type,
    required this.amountPaisa,
    required this.feePaisa,
    required this.occurredAt,
    required this.categoryKey,
    required this.accountType,
    required this.note,
    required this.counterparty,
    required this.trxId,
    required this.source,
    required this.confidence,
    this.pendingId,
  });

  Money get amount => Money(amountPaisa);

  TransactionDraft copyWith({String? categoryKey, String? source}) =>
      TransactionDraft(
        type: type,
        amountPaisa: amountPaisa,
        feePaisa: feePaisa,
        occurredAt: occurredAt,
        categoryKey: categoryKey ?? this.categoryKey,
        accountType: accountType,
        note: note,
        counterparty: counterparty,
        trxId: trxId,
        source: source ?? this.source,
        confidence: confidence,
        pendingId: pendingId,
      );

  Map<String, dynamic> toJson() => {
        'type': type,
        'amountPaisa': amountPaisa,
        'feePaisa': feePaisa,
        'occurredAt': occurredAt,
        'categoryKey': categoryKey,
        'accountType': accountType,
        'note': note,
        'counterparty': counterparty,
        'trxId': trxId,
        'source': source,
        'confidence': confidence,
      };

  TransactionDraft withPendingId(String id) => TransactionDraft(
        type: type,
        amountPaisa: amountPaisa,
        feePaisa: feePaisa,
        occurredAt: occurredAt,
        categoryKey: categoryKey,
        accountType: accountType,
        note: note,
        counterparty: counterparty,
        trxId: trxId,
        source: source,
        confidence: confidence,
        pendingId: id,
      );

  factory TransactionDraft.fromJson(Map<String, dynamic> j) => TransactionDraft(
        type: j['type'] as String,
        amountPaisa: (j['amountPaisa'] as num).toInt(),
        feePaisa: ((j['feePaisa'] ?? 0) as num).toInt(),
        occurredAt: j['occurredAt'] as String,
        categoryKey: j['categoryKey'] as String?,
        accountType: j['accountType'] as String?,
        note: (j['note'] ?? '') as String,
        counterparty: j['counterparty'] as String?,
        trxId: j['trxId'] as String?,
        source: (j['source'] ?? 'ai_text') as String,
        confidence: ((j['confidence'] ?? 0) as num).toDouble(),
      );
}

/// `POST /v1/families/:id/ai/parse`.
class ParseResponse {
  final List<TransactionDraft> drafts;
  final bool usedAi;
  const ParseResponse(this.drafts, this.usedAi);

  factory ParseResponse.fromJson(Map<String, dynamic> j) => ParseResponse(
        [
          for (final d in j['drafts'] as List<dynamic>)
            TransactionDraft.fromJson(d as Map<String, dynamic>),
        ],
        j['usedAi'] as bool,
      );
  Map<String, dynamic> toJson() => {
        'drafts': [for (final d in drafts) d.toJson()],
        'usedAi': usedAi,
      };
}
