import 'package:flutter/material.dart';

import '../../../core/l10n/l10n_x.dart';
import '../../../core/theme/tokens.dart';
import '../../../ui/big_button.dart';

/// Friendly card for an invite link that is expired or already used (F6, FR-ONB-03).
/// T-MOB-18 shows it on the join screen. The nudge button is shown only when the
/// inviter's name is known; [onNudge] sends them a buzz.
class InviteExpiredCard extends StatelessWidget {
  const InviteExpiredCard({super.key, this.inviterName, this.onNudge});

  final String? inviterName;
  final VoidCallback? onNudge;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final name = inviterName?.trim();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
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
              color: AppTokens.amberTint,
              shape: BoxShape.circle,
            ),
            child: const ExcludeSemantics(
              child: Icon(
                Icons.schedule_outlined,
                size: 40,
                color: AppTokens.amberInk,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            l10n.auth_inviteExpired_title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w700,
              color: AppTokens.amberInk,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            l10n.auth_inviteExpired_body,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 17,
              height: 1.45,
              color: AppTokens.ink,
            ),
          ),
          if (name != null && name.isNotEmpty) ...[
            const SizedBox(height: 18),
            BigButton(
              label: l10n.auth_inviteExpired_nudge(name),
              style: BigButtonStyle.amber,
              icon: Icons.vibration,
              height: 64,
              onPressed: onNudge ?? () {},
            ),
          ],
        ],
      ),
    );
  }
}
