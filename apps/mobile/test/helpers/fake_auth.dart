import 'package:amar_poribar/data/api/api_client.dart';
import 'package:amar_poribar/data/auth/session_manager.dart';
import 'package:amar_poribar/data/auth/token_store.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:mocktail/mocktail.dart';

class _Api extends Mock implements ApiClient {}

class _NoTokens implements TokenStore {
  @override
  Future<Tokens?> read() async => null;
  @override
  Future<void> write(Tokens t) async {}
  @override
  Future<void> clear() async {}
}

/// An [AuthNotifier] whose state the test sets directly. [completeSignIn] applies
/// [afterSignIn] when given (for example, the families the server would now return).
class FakeAuthNotifier extends AuthNotifier {
  FakeAuthNotifier(AuthState initial, {this.afterSignIn})
      : super(
          _Api(),
          SessionManager(
            store: _NoTokens(),
            refresh: (_) async => throw UnimplementedError(),
          ),
        ) {
    state = initial;
  }

  final AuthState? afterSignIn;

  void set(AuthState s) => state = s;

  @override
  Future<void> completeSignIn() async {
    final next = afterSignIn;
    if (next != null) state = next;
  }
}
