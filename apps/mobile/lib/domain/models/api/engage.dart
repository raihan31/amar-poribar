import 'package:json_annotation/json_annotation.dart';

part 'engage.g.dart';

// Shapes follow SRS 6.1 (notifications, shopping, lending, billing, privacy).
// No server routes exist yet, so there are no shared fixtures for these.

@JsonSerializable(explicitToJson: true)
class InboxItem {
  final String id;
  final String kind;
  final String title;
  final String body;
  final String? speechText;
  final Map<String, dynamic>? data;
  final String createdAt;
  final String? readAt;
  const InboxItem({
    required this.id,
    required this.kind,
    required this.title,
    required this.body,
    this.speechText,
    this.data,
    required this.createdAt,
    this.readAt,
  });
  factory InboxItem.fromJson(Map<String, dynamic> j) => _$InboxItemFromJson(j);
  Map<String, dynamic> toJson() => _$InboxItemToJson(this);
}

@JsonSerializable(explicitToJson: true)
class Preferences {
  final Map<String, bool> kinds;
  final String? quietStart;
  final String? quietEnd;
  final String? dailyReminderTime;
  final bool hidePresence;
  const Preferences({
    required this.kinds,
    this.quietStart,
    this.quietEnd,
    this.dailyReminderTime,
    this.hidePresence = false,
  });
  factory Preferences.fromJson(Map<String, dynamic> j) =>
      _$PreferencesFromJson(j);
  Map<String, dynamic> toJson() => _$PreferencesToJson(this);
}

@JsonSerializable(explicitToJson: true)
class ShoppingItem {
  final String id;
  final String listId;
  final String name;
  final String? qtyText;
  final int? estPricePaisa;
  final String? checkedBy;
  final String? checkedAt;
  final int position;
  const ShoppingItem({
    required this.id,
    required this.listId,
    required this.name,
    this.qtyText,
    this.estPricePaisa,
    this.checkedBy,
    this.checkedAt,
    required this.position,
  });
  factory ShoppingItem.fromJson(Map<String, dynamic> j) =>
      _$ShoppingItemFromJson(j);
  Map<String, dynamic> toJson() => _$ShoppingItemToJson(this);
}

@JsonSerializable(explicitToJson: true)
class ShoppingList {
  final String id;
  final String familyId;
  final String name;
  final String? archivedAt;
  final List<ShoppingItem> items;
  const ShoppingList({
    required this.id,
    required this.familyId,
    required this.name,
    this.archivedAt,
    this.items = const [],
  });
  factory ShoppingList.fromJson(Map<String, dynamic> j) =>
      _$ShoppingListFromJson(j);
  Map<String, dynamic> toJson() => _$ShoppingListToJson(this);
}

@JsonSerializable(explicitToJson: true)
class Dhar {
  final String id;
  final String familyId;
  final String direction; // lent | borrowed
  final String personName;
  final String? personPhone;
  final int amountPaisa;
  final int repaidPaisa;
  final String date;
  final String? dueDate;
  final String? note;
  final bool isPrivate;
  final String? settledAt;
  const Dhar({
    required this.id,
    required this.familyId,
    required this.direction,
    required this.personName,
    this.personPhone,
    required this.amountPaisa,
    this.repaidPaisa = 0,
    required this.date,
    this.dueDate,
    this.note,
    this.isPrivate = false,
    this.settledAt,
  });
  factory Dhar.fromJson(Map<String, dynamic> j) => _$DharFromJson(j);
  Map<String, dynamic> toJson() => _$DharToJson(this);
}

@JsonSerializable(explicitToJson: true)
class Plan {
  final String code;
  final String nameBn;
  final String nameEn;
  final int pricePaisa;
  final int memberLimit;
  final int aiQuotaMonth;
  final int? historyMonths;
  const Plan({
    required this.code,
    required this.nameBn,
    required this.nameEn,
    required this.pricePaisa,
    required this.memberLimit,
    required this.aiQuotaMonth,
    this.historyMonths,
  });
  factory Plan.fromJson(Map<String, dynamic> j) => _$PlanFromJson(j);
  Map<String, dynamic> toJson() => _$PlanToJson(this);
}

@JsonSerializable(explicitToJson: true)
class Subscription {
  final String planCode;
  final String status;
  final String? currentPeriodEnd;
  final int memberLimit;
  final int aiQuotaMonth;
  final int aiUsedMonth;
  final int? historyMonths;
  final Map<String, dynamic> flags;
  const Subscription({
    required this.planCode,
    required this.status,
    this.currentPeriodEnd,
    required this.memberLimit,
    required this.aiQuotaMonth,
    this.aiUsedMonth = 0,
    this.historyMonths,
    this.flags = const {},
  });
  factory Subscription.fromJson(Map<String, dynamic> j) =>
      _$SubscriptionFromJson(j);
  Map<String, dynamic> toJson() => _$SubscriptionToJson(this);
}

@JsonSerializable(explicitToJson: true)
class Invoice {
  final String id;
  final String planCode;
  final int amountPaisa;
  final String status;
  final String issuedAt;
  const Invoice({
    required this.id,
    required this.planCode,
    required this.amountPaisa,
    required this.status,
    required this.issuedAt,
  });
  factory Invoice.fromJson(Map<String, dynamic> j) => _$InvoiceFromJson(j);
  Map<String, dynamic> toJson() => _$InvoiceToJson(this);
}

@JsonSerializable(explicitToJson: true)
class PrivacyRequest {
  final String id;
  final String kind; // export | erasure
  final String status;
  final String? step;
  final String requestedAt;
  final String? dueAt;
  final String? completedAt;
  const PrivacyRequest({
    required this.id,
    required this.kind,
    required this.status,
    this.step,
    required this.requestedAt,
    this.dueAt,
    this.completedAt,
  });
  factory PrivacyRequest.fromJson(Map<String, dynamic> j) =>
      _$PrivacyRequestFromJson(j);
  Map<String, dynamic> toJson() => _$PrivacyRequestToJson(this);
}
