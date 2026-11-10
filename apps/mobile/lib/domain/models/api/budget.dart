import 'package:json_annotation/json_annotation.dart';

part 'budget.g.dart';

@JsonSerializable(explicitToJson: true)
class BudgetLine {
  final String? categoryId;
  final bool inherited;
  final String level; // ok | warning | exceeded
  final int limitPaisa;
  final String nameBn;
  final String nameEn;
  final int spentPaisa;
  const BudgetLine({
    required this.categoryId,
    required this.inherited,
    required this.level,
    required this.limitPaisa,
    required this.nameBn,
    required this.nameEn,
    required this.spentPaisa,
  });
  factory BudgetLine.fromJson(Map<String, dynamic> j) =>
      _$BudgetLineFromJson(j);
  Map<String, dynamic> toJson() => _$BudgetLineToJson(this);
}

@JsonSerializable(explicitToJson: true)
class BudgetList {
  final List<BudgetLine> budgets;
  final String month;
  const BudgetList({required this.budgets, required this.month});
  factory BudgetList.fromJson(Map<String, dynamic> j) =>
      _$BudgetListFromJson(j);
  Map<String, dynamic> toJson() => _$BudgetListToJson(this);
}

@JsonSerializable(explicitToJson: true)
class FestivalBudget {
  final String id;
  final String name;
  final int limitPaisa;
  final int spentPaisa;
  final String startsOn;
  final String endsOn;
  const FestivalBudget({
    required this.id,
    required this.name,
    required this.limitPaisa,
    required this.spentPaisa,
    required this.startsOn,
    required this.endsOn,
  });
  factory FestivalBudget.fromJson(Map<String, dynamic> j) =>
      _$FestivalBudgetFromJson(j);
  Map<String, dynamic> toJson() => _$FestivalBudgetToJson(this);
}

@JsonSerializable(explicitToJson: true)
class Recurring {
  final String id;
  final String type;
  final int amountPaisa;
  final String? categoryId;
  final String? accountId;
  final String? note;
  final String frequency;
  final int dayOfMonth;
  final bool active;
  const Recurring({
    required this.id,
    required this.type,
    required this.amountPaisa,
    required this.categoryId,
    required this.accountId,
    required this.note,
    required this.frequency,
    required this.dayOfMonth,
    required this.active,
  });
  factory Recurring.fromJson(Map<String, dynamic> j) => _$RecurringFromJson(j);
  Map<String, dynamic> toJson() => _$RecurringToJson(this);
}
