// ignore_for_file: file_names
import 'package:amar_poribar/features/auth/data/auth_repository.dart';
import 'package:amar_poribar/features/auth/data/fake_auth_repository.dart';
import 'package:amar_poribar/features/auth/domain/otp_failure.dart';
import 'package:amar_poribar/features/auth/state/login_controller.dart';
import 'package:amar_poribar/features/auth/ui/login_screen.dart';

import 'golden_config.dart';

class _WrongCode extends LoginController {
  _WrongCode(super.repo, super.now, super.signedIn) {
    state = const LoginState(
      phone: '+8801712345678',
      code: '479103',
      phase: LoginPhase.code,
      codesRequested: 2,
      error: Invalid(4),
    );
  }
}

void main() {
  final repo = FakeAuthRepository();
  goldenScreen(
    'A7_otp_error',
    const LoginScreen(phase: LoginPhase.code),
    overrides: [
      authRepositoryProvider.overrideWithValue(repo),
      loginControllerProvider.overrideWith(
        (ref) => _WrongCode(repo, DateTime.now, () async {}),
      ),
    ],
  );
}
