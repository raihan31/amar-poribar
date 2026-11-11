// ignore_for_file: file_names
import 'package:amar_poribar/features/family/ui/join_screen.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';

import '../helpers/fake_auth.dart';
import 'golden_config.dart';

void main() {
  goldenScreen(
    'A6_join',
    const JoinScreen(token: 'abc'),
    overrides: [
      authProvider.overrideWith(
        (ref) => FakeAuthNotifier(const AuthState(loaded: true, token: 't')),
      ),
    ],
  );
}
