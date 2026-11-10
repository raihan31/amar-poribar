import 'package:json_annotation/json_annotation.dart';

part 'family.g.dart';

@JsonSerializable(explicitToJson: true)
class Family {
  final int aiQuotaMonth;
  final String createdAt;
  final String createdBy;
  final String currency;
  final String id;
  final String name;
  final String plan;
  final String updatedAt;
  const Family({
    required this.aiQuotaMonth,
    required this.createdAt,
    required this.createdBy,
    required this.currency,
    required this.id,
    required this.name,
    required this.plan,
    required this.updatedAt,
  });
  factory Family.fromJson(Map<String, dynamic> j) => _$FamilyFromJson(j);
  Map<String, dynamic> toJson() => _$FamilyToJson(this);
}

@JsonSerializable(explicitToJson: true)
class ApiMember {
  final String? name;
  final String phone;
  final String role;
  final String userId;
  const ApiMember({
    required this.name,
    required this.phone,
    required this.role,
    required this.userId,
  });
  factory ApiMember.fromJson(Map<String, dynamic> j) => _$ApiMemberFromJson(j);
  Map<String, dynamic> toJson() => _$ApiMemberToJson(this);
}
