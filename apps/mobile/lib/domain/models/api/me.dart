import 'package:json_annotation/json_annotation.dart';

part 'me.g.dart';

class FamilyInfo {
  final String id;
  final String name;
  final String role;
  const FamilyInfo(this.id, this.name, this.role);

  factory FamilyInfo.fromJson(Map<String, dynamic> j) => FamilyInfo(
        j['id'] as String,
        j['name'] as String,
        j['role'] as String,
      );
  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'role': role};
}

@JsonSerializable(explicitToJson: true)
class UserProfile {
  final bool bnDigits;
  final String createdAt;
  final String id;
  final String locale;
  final String? name;
  final String phone;
  final String updatedAt;
  const UserProfile({
    required this.bnDigits,
    required this.createdAt,
    required this.id,
    required this.locale,
    required this.name,
    required this.phone,
    required this.updatedAt,
  });
  factory UserProfile.fromJson(Map<String, dynamic> j) =>
      _$UserProfileFromJson(j);
  Map<String, dynamic> toJson() => _$UserProfileToJson(this);
}

/// `GET /v1/me`.
class Me {
  final UserProfile user;
  final List<FamilyInfo> families;
  const Me(this.user, this.families);

  factory Me.fromJson(Map<String, dynamic> j) => Me(
        UserProfile.fromJson(j['user'] as Map<String, dynamic>),
        [
          for (final f in j['families'] as List<dynamic>)
            FamilyInfo.fromJson(f as Map<String, dynamic>),
        ],
      );
  Map<String, dynamic> toJson() => {
        'families': [for (final f in families) f.toJson()],
        'user': user.toJson(),
      };
}
