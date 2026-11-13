/// A family member as the shared widgets need it.
class Member {
  const Member({required this.id, required this.name, this.avatarIndex = 0});

  final String id;
  final String name;

  /// Picks the colour pair in `AppTokens.avatars` (wraps around).
  final int avatarIndex;
}
