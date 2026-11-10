// ignore_for_file: file_names
import 'package:amar_poribar/features/auth/data/auth_repository.dart';
import 'package:amar_poribar/features/auth/data/fake_auth_repository.dart';
import 'package:amar_poribar/features/auth/state/login_controller.dart';
import 'package:amar_poribar/features/auth/ui/login_screen.dart';

import 'golden_config.dart';

class _CodeStep extends LoginController {
  _CodeStep(super.repo, super.now, super.signedIn) {
    state = const LoginState(
      phone: '+8801712345678',
      code: '472',
      phase: LoginPhase.code,
      resendSecondsLeft: 42,
    );
  }
}

void main() {
  final repo = FakeAuthRepository();
  goldenScreen(
    'A1_login',
    const LoginScreen(),
    overrides: [authRepositoryProvider.overrideWithValue(repo)],
  );
  goldenScreen(
    'A1_login_code',
    const LoginScreen(phase: LoginPhase.code),
    overrides: [
      authRepositoryProvider.overrideWithValue(repo),
      loginControllerProvider.overrideWith(
        (ref) => _CodeStep(repo, DateTime.now, () async {}),
      ),
    ],
  );
}
