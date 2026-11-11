import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/redirects.dart';
import '../../../core/l10n/l10n_x.dart';
import '../../../core/theme/tokens.dart';
import '../../../presentation/providers/auth_provider.dart';
import '../../../ui/big_button.dart';

/// F6: the refresh token failed. Calm wording, one big button (FR-AUTH-09).
/// Board: SessionExpired.dc.html. Route `/session-expired?from=`.
///
/// The button clears the tokens but keeps the local database, then opens
/// `/login?from=<encoded>`; after sign-in the login screen returns to `from`.
class SessionExpiredScreen extends ConsumerWidget {
  const SessionExpiredScreen({super.key, this.from});

  final String? from;

  Future<void> _signInAgain(BuildContext context, WidgetRef ref) async {
    await ref.read(tokenStoreProvider).clear();
    if (!context.mounted) return;
    final target = from == null
        ? Routes.login
        : '${Routes.login}?from=${Uri.encodeQueryComponent(from!)}';
    context.go(target);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    return Scaffold(
      backgroundColor: AppTokens.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            children: [
              const SizedBox(height: 48),
              Container(
                width: double.infinity,
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                decoration: BoxDecoration(
                  color: AppTokens.white,
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: AppTokens.border),
                ),
                child: Column(
                  children: [
                    Container(
                      width: 72,
                      height: 72,
                      decoration: const BoxDecoration(
                        color: AppTokens.greenTint,
                        shape: BoxShape.circle,
                      ),
                      child: const ExcludeSemantics(
                        child: Icon(
                          Icons.lock_outline,
                          size: 40,
                          color: AppTokens.green,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      l10n.auth_expired_title,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w700,
                        color: AppTokens.green,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      l10n.auth_expired_body,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 17,
                        height: 1.45,
                        color: AppTokens.ink,
                      ),
                    ),
                    const SizedBox(height: 18),
                    BigButton(
                      key: const Key('session_expired_sign_in'),
                      label: l10n.auth_expired_button,
                      icon: Icons.phone_outlined,
                      height: 72,
                      onPressed: () => _signInAgain(context, ref),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              Padding(
                padding: const EdgeInsets.only(bottom: 28),
                child: Text(
                  l10n.auth_expired_footer,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 14, color: AppTokens.muted),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
