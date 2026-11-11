import '../../../data/api/api_exception.dart';
import '../../../data/api/family_api.dart';
import '../../../domain/models/api/me.dart';

/// What the invited person sees before joining (`GET /v1/invites/:token`).
class InvitePreview {
  const InvitePreview({
    required this.familyName,
    required this.inviterName,
    required this.role,
    required this.memberCount,
    required this.expiresAt,
  });

  final String familyName;
  final String inviterName;

  /// Wire role: `admin`, `member` or `viewer`.
  final String role;
  final int memberCount;
  final DateTime expiresAt;

  /// Whole days left, at least 0.
  int daysLeft(DateTime now) {
    final d = expiresAt.difference(now);
    return d.isNegative ? 0 : (d.inHours / 24).ceil();
  }
}

/// A rejected invite. [code] is `invite_expired`, `invite_used` or `invite_not_for_you`.
class InviteException implements Exception {
  const InviteException(this.code, {this.inviterName});
  final String code;
  final String? inviterName;

  bool get isExpiredOrUsed => code == 'invite_expired' || code == 'invite_used';

  @override
  String toString() => code;
}

abstract class InviteRepository {
  Future<InvitePreview> preview(String token);

  /// Joins the family; returns it so the app can make it the active one.
  Future<FamilyInfo> accept(String token);
}

/// Real implementation. The server answers the preview with a `state`
/// (`valid`, `used`, `expired`, `revoked`) instead of an error, so it is mapped here.
class ApiInviteRepository implements InviteRepository {
  ApiInviteRepository(this.api);
  final FamilyApi api;

  String _familyName = '';

  @override
  Future<InvitePreview> preview(String token) async {
    final Map<String, dynamic> j;
    try {
      j = await api.invitePreview(token);
    } on ApiException catch (e) {
      throw _map(e);
    }
    final inviter = (j['invitedBy'] as Map?)?['name'] as String? ?? '';
    final state = j['state'] as String? ?? 'valid';
    if (state != 'valid') {
      throw InviteException(
        state == 'used' ? 'invite_used' : 'invite_expired',
        inviterName: inviter,
      );
    }
    _familyName = j['familyName'] as String;
    return InvitePreview(
      familyName: _familyName,
      inviterName: inviter,
      role: j['role'] as String,
      memberCount: (j['memberCount'] as num).toInt(),
      expiresAt: DateTime.parse(j['expiresAt'] as String),
    );
  }

  @override
  Future<FamilyInfo> accept(String token) async {
    try {
      final j = await api.acceptInvite(token);
      return FamilyInfo(
        j['familyId'] as String,
        _familyName,
        j['role'] as String? ?? 'member',
      );
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  static Object _map(ApiException e) => switch (e.code) {
        'invite_expired' ||
        'invite_revoked' ||
        'invite_not_found' =>
          const InviteException('invite_expired'),
        'invite_used' => const InviteException('invite_used'),
        'invite_wrong_phone' ||
        'invite_not_for_you' =>
          const InviteException('invite_not_for_you'),
        _ => e,
      };
}

/// In-memory invites for tests and previews. Tokens: `abc` is valid, `viewer` is a viewer
/// invite, `old` is expired, `used` is used, `other` is for another number.
class FakeInviteRepository implements InviteRepository {
  FakeInviteRepository({DateTime? now, this.joinedFamily})
      : _now = now ?? DateTime.utc(2026, 11, 9, 4);

  final DateTime _now;
  final FamilyInfo? joinedFamily;
  final List<String> accepted = [];

  @override
  Future<InvitePreview> preview(String token) async {
    switch (token) {
      case 'old':
        throw const InviteException('invite_expired', inviterName: 'আব্বু');
      case 'used':
        throw const InviteException('invite_used', inviterName: 'আব্বু');
      case 'other':
        throw const InviteException('invite_not_for_you');
    }
    return InvitePreview(
      familyName: 'রহিম পরিবার',
      inviterName: 'আব্বু',
      role: token == 'viewer' ? 'viewer' : 'member',
      memberCount: 5,
      expiresAt: _now.add(const Duration(days: 6)),
    );
  }

  @override
  Future<FamilyInfo> accept(String token) async {
    accepted.add(token);
    return joinedFamily ?? const FamilyInfo('f-rahim', 'রহিম পরিবার', 'member');
  }
}
