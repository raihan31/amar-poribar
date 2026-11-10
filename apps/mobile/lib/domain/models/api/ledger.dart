import 'package:json_annotation/json_annotation.dart';

part 'ledger.g.dart';

@JsonSerializable(explicitToJson: true)
class ApiAccount {
  final String? archivedAt;
  final String createdAt;
  final String familyId;
  final String id;
  final String name;
  final int openingBalancePaisa;
  final String? ownerUserId;
  final String type;
  final String updatedAt;
  const ApiAccount({
    required this.archivedAt,
    required this.createdAt,
    required this.familyId,
    required this.id,
    required this.name,
    required this.openingBalancePaisa,
    required this.ownerUserId,
    required this.type,
    required this.updatedAt,
  });
  factory ApiAccount.fromJson(Map<String, dynamic> j) =>
      _$ApiAccountFromJson(j);
  Map<String, dynamic> toJson() => _$ApiAccountToJson(this);
}

@JsonSerializable(explicitToJson: true)
class ApiCategory {
  final String familyId;
  final String? icon;
  final String id;
  final bool isHidden;
  final String? key;
  final String kind;
  final String nameBn;
  final String nameEn;
  const ApiCategory({
    required this.familyId,
    required this.icon,
    required this.id,
    required this.isHidden,
    required this.key,
    required this.kind,
    required this.nameBn,
    required this.nameEn,
  });
  factory ApiCategory.fromJson(Map<String, dynamic> j) =>
      _$ApiCategoryFromJson(j);
  Map<String, dynamic> toJson() => _$ApiCategoryToJson(this);
}

/// A transaction as carried in a sync changeset.
@JsonSerializable(explicitToJson: true)
class SyncTransactionChange {
  final String accountId;
  final int amountPaisa;
  final String? categoryId;
  final String? counterparty;
  final String? deletedAt;
  final int feePaisa;
  final String hlc;
  final String id;
  final bool isPrivate;
  final String? note;
  final String occurredAt;
  final String source;
  final String? trxId;
  final String type;
  const SyncTransactionChange({
    required this.accountId,
    required this.amountPaisa,
    required this.categoryId,
    required this.counterparty,
    required this.deletedAt,
    required this.feePaisa,
    required this.hlc,
    required this.id,
    required this.isPrivate,
    required this.note,
    required this.occurredAt,
    required this.source,
    required this.trxId,
    required this.type,
  });
  factory SyncTransactionChange.fromJson(Map<String, dynamic> j) =>
      _$SyncTransactionChangeFromJson(j);
  Map<String, dynamic> toJson() => _$SyncTransactionChangeToJson(this);
}

@JsonSerializable(explicitToJson: true)
class ApiTransaction {
  final String accountId;
  final double? aiConfidence;
  final int amountPaisa;
  final String? categoryId;
  final String? counterparty;
  final String createdAt;
  final String createdBy;
  final String? deletedAt;
  final String familyId;
  final int feePaisa;
  final String hlc;
  final String id;
  final bool isPrivate;
  final String? note;
  final String occurredAt;
  final String? paidByUserId;
  final String source;
  final int syncSeq;
  final String? trxId;
  final String type;
  final String updatedAt;
  const ApiTransaction({
    required this.accountId,
    required this.aiConfidence,
    required this.amountPaisa,
    required this.categoryId,
    required this.counterparty,
    required this.createdAt,
    required this.createdBy,
    required this.deletedAt,
    required this.familyId,
    required this.feePaisa,
    required this.hlc,
    required this.id,
    required this.isPrivate,
    required this.note,
    required this.occurredAt,
    required this.paidByUserId,
    required this.source,
    required this.syncSeq,
    required this.trxId,
    required this.type,
    required this.updatedAt,
  });
  factory ApiTransaction.fromJson(Map<String, dynamic> j) =>
      _$ApiTransactionFromJson(j);
  Map<String, dynamic> toJson() => _$ApiTransactionToJson(this);
}
