import 'package:flutter/material.dart';

import '../../../core/l10n/l10n_x.dart';
import '../../../core/theme/tokens.dart';
import '../../../ui/big_button.dart';
import '../domain/otp_failure.dart';

/// The words for a failed sign-in step: a title (may be null) and a body. Used by the panel
/// and by Simple mode, which reads both aloud (T-MOB-15).
({String? title, String body}) otpFailureText(
  BuildContext context,
  OtpFailure f, {
  required String Function(String) digits,
  required int secondsLeft,
}) {
  final l10n = context.l10n;
  return switch (f) {
    Invalid(:final attemptsLeft) => (
        title: l10n.auth_otp_wrongTitle,
        body: l10n.auth_otp_wrongBody(digits('$attemptsLeft')),
      ),
    Expired() => (
        title: l10n.auth_otp_expiredTitle,
        body: l10n.auth_otp_expiredBody,
      ),
    RateLimited() => (
        title: null,
        body: l10n.auth_otp_rateLimited(formatClock(secondsLeft, digits)),
      ),
    Network() => (title: null, body: l10n.auth_otp_networkDown),
    Server() => (title: null, body: l10n.auth_otp_serverDown),
  };
}

/// `m:ss` with the numeral setting applied.
String formatClock(int seconds, String Function(String) digits) =>
    digits('${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}');

/// Red panel under the code boxes (board: OtpError.dc.html) with the next step for each
/// [OtpFailure]. [showActions] is false on the phone step, where only the message makes sense.
class OtpErrorPanel extends StatelessWidget {
  const OtpErrorPanel({
    super.key,
    required this.failure,
    required this.digits,
    required this.secondsLeft,
    required this.codesRequested,
    required this.onNewCode,
    required this.onChangeNumber,
    this.showActions = true,
    this.newCodeFocus,
  });

  final OtpFailure failure;
  final String Function(String) digits;
  final int secondsLeft;
  final int codesRequested;
  final VoidCallback? onNewCode;
  final VoidCallback onChangeNumber;
  final bool showActions;
  final FocusNode? newCodeFocus;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final f = failure;
    final text = otpFailureText(
      context,
      f,
      digits: digits,
      secondsLeft: secondsLeft,
    );
    final newCode = showActions && (f is Invalid || f is Expired);
    final lockout = showActions && f is RateLimited;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          liveRegion: true,
          container: true,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: AppTokens.dangerTint,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(
              children: [
                const ExcludeSemantics(child: _ErrorIcon()),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (text.title != null)
                        Text(
                          text.title!,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: AppTokens.dangerInk,
                          ),
                        ),
                      Text(
                        text.body,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: text.title == null
                              ? FontWeight.w600
                              : FontWeight.w400,
                          color: AppTokens.dangerInk,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        if (newCode || lockout) ...[
          const SizedBox(height: 20),
          Focus(
            focusNode: newCodeFocus,
            child: BigButton(
              label: l10n.auth_otp_newCode,
              style: BigButtonStyle.outline,
              height: 64,
              onPressed: lockout ? null : onNewCode,
            ),
          ),
        ],
        if (showActions && f is! Expired && f is! Network && f is! Server)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: TextButton(
              onPressed: onChangeNumber,
              style: TextButton.styleFrom(
                minimumSize: const Size.fromHeight(56),
                foregroundColor: AppTokens.muted,
              ),
              child: Text(
                l10n.auth_otp_wrongNumber,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
          ),
        if (showActions && f is Invalid) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: AppTokens.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFE8DCC8)),
            ),
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: l10n.auth_otp_helpTitle,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  TextSpan(text: ' ${l10n.auth_otp_helpBody}'),
                ],
              ),
              style: const TextStyle(
                fontSize: 15,
                height: 1.5,
                color: Color(0xFF4A3C2C),
              ),
            ),
          ),
        ],
        if (showActions && (f is Invalid || f is RateLimited)) ...[
          const SizedBox(height: 12),
          Text(
            l10n.auth_otp_limitNote(digits('$codesRequested')),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 14, color: AppTokens.muted),
          ),
        ],
      ],
    );
  }
}

class _ErrorIcon extends StatelessWidget {
  const _ErrorIcon();

  @override
  Widget build(BuildContext context) => const Icon(
        Icons.error_outline,
        size: 30,
        color: AppTokens.dangerInk,
      );
}

/// "ঢুকুন" while it cannot be used (no tries left, or a wait is running): tan background,
/// brown text, announced as disabled.
class LockedSubmitButton extends StatelessWidget {
  const LockedSubmitButton({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) => Semantics(
        container: true,
        button: true,
        enabled: false,
        label: label,
        excludeSemantics: true,
        child: Container(
          height: 72,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppTokens.switchOff,
            borderRadius: BorderRadius.circular(36),
          ),
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: Color(0xFF4A3C2C),
            ),
          ),
        ),
      );
}
