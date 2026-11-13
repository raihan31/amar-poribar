import 'role.dart';

/// A family member as the screens and shared widgets need it.
class Member {
  const Member({
    required this.userId,
    required this.name,
    required this.role,
    this.phoneLast3 = '',
    this.avatarIndex = 0,
    this.online = false,
    this.lastSeen,
  });

  final String userId;
  final String name;
  final FamilyRole role;
  final String phoneLast3;

  /// Picks the colour pair in `AppTokens.avatars` (wraps around).
  final int avatarIndex;
  final bool online;
  final DateTime? lastSeen;
}
