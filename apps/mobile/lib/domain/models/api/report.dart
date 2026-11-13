import 'package:json_annotation/json_annotation.dart';

part 'report.g.dart';

@JsonSerializable(explicitToJson: true)
class TotalById {
  final String id;
  final String name;
  final int totalPaisa;
  const TotalById({
    required this.id,
    required this.name,
    required this.totalPaisa,
  });
  factory TotalById.fromJson(Map<String, dynamic> j) => _$TotalByIdFromJson(j);
  Map<String, dynamic> toJson() => _$TotalByIdToJson(this);
}

@JsonSerializable(explicitToJson: true)
class TotalByCategory {
  final String? categoryId;
  final String name;
  final int totalPaisa;
  const TotalByCategory({
    required this.categoryId,
    required this.name,
    required this.totalPaisa,
  });
  factory TotalByCategory.fromJson(Map<String, dynamic> j) =>
      _$TotalByCategoryFromJson(j);
  Map<String, dynamic> toJson() => _$TotalByCategoryToJson(this);
}

@JsonSerializable(explicitToJson: true)
class MonthTotals {
  final int expensePaisa;
  final int incomePaisa;
  final String month;
  const MonthTotals({
    required this.expensePaisa,
    required this.incomePaisa,
    required this.month,
  });
  factory MonthTotals.fromJson(Map<String, dynamic> j) =>
      _$MonthTotalsFromJson(j);
  Map<String, dynamic> toJson() => _$MonthTotalsToJson(this);
}

/// `GET /v1/families/:id/reports/summary` (the "Report" model).
@JsonSerializable(explicitToJson: true)
class ReportSummary {
  final List<TotalById> byAccount;
  final List<TotalByCategory> byCategory;
  final List<TotalById> byMember;
  final int expensePaisa;
  final int incomePaisa;
  final String month;
  final MonthTotals previous;
  const ReportSummary({
    required this.byAccount,
    required this.byCategory,
    required this.byMember,
    required this.expensePaisa,
    required this.incomePaisa,
    required this.month,
    required this.previous,
  });
  factory ReportSummary.fromJson(Map<String, dynamic> j) =>
      _$ReportSummaryFromJson(j);
  Map<String, dynamic> toJson() => _$ReportSummaryToJson(this);
}

/// `GET /v1/families/:id/ai/summary` (the monthly spoken summary).
@JsonSerializable(explicitToJson: true)
class MonthlySummary {
  final String locale;
  final String month;
  final String speechText;
  final String text;
  final bool usedAi;
  const MonthlySummary({
    required this.locale,
    required this.month,
    required this.speechText,
    required this.text,
    required this.usedAi,
  });
  factory MonthlySummary.fromJson(Map<String, dynamic> j) =>
      _$MonthlySummaryFromJson(j);
  Map<String, dynamic> toJson() => _$MonthlySummaryToJson(this);
}
