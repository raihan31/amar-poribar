import '../../../domain/models/api/me.dart';
import 'profile_repository.dart';

/// In memory. Records every accepted update; [failures] are thrown first, one per `update` call.
class FakeProfileRepository implements ProfileRepository {
  FakeProfileRepository({
    String? name = 'আব্বু',
    String phone = '+8801712345678',
    List<Object>? failures,
  })  : _name = name,
        _phone = phone,
        failures = [...?failures];

  String? _name;
  final String _phone;
  final List<Object> failures;

  /// Patches that were accepted.
  final List<ProfilePatch> updates = [];

  /// Every `update` call, including ones that failed.
  int attempts = 0;

  Me _me() => Me(
        UserProfile(
          bnDigits: true,
          createdAt: '2026-01-01T00:00:00Z',
          id: 'u1',
          locale: 'bn',
          name: _name,
          phone: _phone,
          updatedAt: '2026-01-01T00:00:00Z',
        ),
        const [],
      );

  @override
  Future<Me> load() async => _me();

  @override
  Future<Me> update(ProfilePatch patch) async {
    attempts++;
    if (failures.isNotEmpty) throw failures.removeAt(0);
    updates.add(patch);
    if (patch.name != null) _name = patch.name;
    return _me();
  }
}
