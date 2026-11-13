import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/redirects.dart';
import '../../../core/l10n/l10n_x.dart';
import '../../../core/money/money_format.dart';
import '../../../core/money/numeral_style_provider.dart';
import '../../../core/theme/tokens.dart';
import '../../../domain/models/role.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../../presentation/providers/auth_provider.dart';
import '../../../presentation/providers/providers.dart';
import '../../../ui/big_button.dart';
import '../../auth/ui/invite_expired_card.dart';
import '../data/invite_repository.dart';
import '../state/active_family.dart';
import '../state/family_providers.dart';

/// `Meta` key holding an invite token while the person signs in.
const kPendingInviteKey = 'pending_invite';

/// A6 and F6: join a family from an invite link. Board: Join.dc.html. Route `/join/:token`.
///
/// Signed out, the token is kept in `Meta('pending_invite')` and the person goes to
/// `/login?from=/join/<token>`; after sign-in the router brings them back here.
class JoinScreen extends ConsumerStatefulWidget {
  const JoinScreen({super.key, required this.token});

  final String token;

  @override
  ConsumerState<JoinScreen> createState() => _JoinScreenState();
}

class _JoinScreenState extends ConsumerState<JoinScreen> {
  InvitePreview? _preview;
  InviteException? _rejected;
  bool _failed = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    if (!ref.read(authProvider).signedIn) {
      _deferUntilSignedIn();
    } else {
      _load();
    }
  }

  Future<void> _deferUntilSignedIn() async {
    // Providers cannot change while the tree is building.
    await Future<void>.microtask(() {});
    if (!mounted) return;
    ref.read(pendingInviteProvider.notifier).state = widget.token;
    await ref.read(localStoreProvider).setMeta(kPendingInviteKey, widget.token);
    if (!mounted) return;
    context.go(
      '${Routes.login}?from=${Uri.encodeQueryComponent('/join/${widget.token}')}',
    );
  }

  Future<void> _load() async {
    try {
      final p = await ref.read(inviteRepositoryProvider).preview(widget.token);
      if (mounted) setState(() => _preview = p);
    } on InviteException catch (e) {
      if (mounted) setState(() => _rejected = e);
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  Future<void> _clearPending() async {
    ref.read(pendingInviteProvider.notifier).state = null;
    await ref.read(localStoreProvider).setMeta(kPendingInviteKey, '');
  }

  Future<void> _accept() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _failed = false;
    });
    try {
      final family =
          await ref.read(inviteRepositoryProvider).accept(widget.token);
      await _clearPending();
      await ref.read(authProvider.notifier).completeSignIn();
      await ref.read(activeFamilyIdProvider.notifier).select(family.id);
      try {
        await ref.read(familyRepositoryProvider).refresh(family.id);
      } catch (_) {
        // Members load again when the network is back.
      }
      if (mounted) context.go(Routes.home);
    } on InviteException catch (e) {
      if (mounted) {
        setState(() {
          _rejected = e;
          _busy = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _failed = true;
          _busy = false;
        });
      }
    }
  }

  Future<void> _notNow() async {
    await _clearPending();
    if (mounted) context.go(Routes.home);
  }

  @override
  Widget build(BuildContext context) {
    final Widget body;
    final rejected = _rejected;
    if (rejected != null) {
      body = _Rejected(error: rejected, onClose: _notNow);
    } else if (_preview != null) {
      body = _Invite(
        preview: _preview!,
        busy: _busy,
        failed: _failed,
        onAccept: _accept,
        onNotNow: _notNow,
      );
    } else if (_failed) {
      body = _Rejected(error: null, onClose: _notNow);
    } else {
      body = const Center(child: CircularProgressIndicator());
    }
    return Scaffold(
      backgroundColor: AppTokens.bg,
      body: SafeArea(child: body),
    );
  }
}

class _Rejected extends StatelessWidget {
  const _Rejected({required this.error, required this.onClose});

  final InviteException? error;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final e = error;
    final Widget card;
    if (e != null && e.isExpiredOrUsed) {
      card = InviteExpiredCard(inviterName: e.inviterName);
    } else {
      final text = e?.code == 'invite_not_for_you'
          ? l10n.fam_join_wrongNumber
          : l10n.fam_join_failed;
      card = Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: AppTokens.white,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: AppTokens.border),
        ),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 18, color: AppTokens.ink),
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 48, 20, 0),
      child: Column(
        children: [
          card,
          const Spacer(),
          _NotNowButton(label: l10n.fam_join_notNow, onPressed: onClose),
          const SizedBox(height: 18),
        ],
      ),
    );
  }
}

class _NotNowButton extends StatelessWidget {
  const _NotNowButton({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      key: const Key('join_not_now'),
      onPressed: onPressed,
      style: TextButton.styleFrom(
        minimumSize: const Size(double.infinity, 52),
        foregroundColor: AppTokens.muted,
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          decoration: TextDecoration.underline,
        ),
      ),
    );
  }
}

String _roleWord(AppLocalizations l10n, FamilyRole role) => switch (role) {
      FamilyRole.owner => l10n.fam_join_roleOwner,
      FamilyRole.admin => l10n.fam_join_roleAdmin,
      FamilyRole.member => l10n.fam_join_roleMember,
      FamilyRole.viewer => l10n.fam_join_roleViewer,
    };

class _Invite extends ConsumerWidget {
  const _Invite({
    required this.preview,
    required this.busy,
    required this.failed,
    required this.onAccept,
    required this.onNotNow,
  });

  final InvitePreview preview;
  final bool busy;
  final bool failed;
  final VoidCallback onAccept;
  final VoidCallback onNotNow;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final style = ref.watch(numeralStyleProvider);
    String digits(int n) =>
        style == NumeralStyle.bangla ? toBanglaDigits('$n') : '$n';
    final role = FamilyRole.fromWire(preview.role);
    final roleWord = _roleWord(l10n, role);
    final summary = l10n.fam_join_summary(
      digits(preview.memberCount),
      roleWord,
    );
    final days = preview.daysLeft(ref.watch(inviteClockProvider)());
    final initial = preview.inviterName.isEmpty
        ? ''
        : String.fromCharCode(preview.inviterName.runes.first);
    const baseStyle = TextStyle(fontSize: 16, color: AppTokens.muted);
    final at = summary.lastIndexOf(roleWord);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  const SizedBox(height: 40),
                  SizedBox(
                    width: 72.0 * 3 - 16 * 2,
                    height: 72,
                    child: Stack(
                      children: [
                        Positioned(
                          left: 0,
                          child: _JoinAvatar(initial: initial, colorIndex: 3),
                        ),
                        const Positioned(
                          left: 56,
                          child: _JoinAvatar(initial: 'আ', colorIndex: 0),
                        ),
                        const Positioned(
                          left: 112,
                          child: _JoinAvatar(initial: 'দা', colorIndex: 1),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    l10n.fam_join_invitedBy(preview.inviterName),
                    style: const TextStyle(
                      fontSize: 15,
                      color: AppTokens.muted,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    preview.familyName,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w700,
                      color: AppTokens.green,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text.rich(
                    TextSpan(
                      style: baseStyle,
                      children: [
                        TextSpan(text: summary.substring(0, at)),
                        TextSpan(
                          text: roleWord,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: AppTokens.ink,
                          ),
                        ),
                        TextSpan(
                          text: summary.substring(at + roleWord.length),
                        ),
                      ],
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 28),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppTokens.white,
                      borderRadius: BorderRadius.circular(22),
                      border: Border.all(color: AppTokens.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.fam_join_canTitle,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 12),
                        _Bullet(
                          icon: Icons.credit_card_outlined,
                          text: role == FamilyRole.viewer
                              ? l10n.fam_join_bulletViewer
                              : l10n.fam_join_bulletLedger,
                        ),
                        _Bullet(
                          icon: Icons.chat_bubble_outline,
                          text: l10n.fam_join_bulletTalk,
                        ),
                        _Bullet(
                          icon: Icons.lock_outline,
                          text: l10n.fam_join_bulletPrivate,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    l10n.fam_join_expiresIn(digits(days)),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppTokens.muted,
                    ),
                  ),
                  if (failed) ...[
                    const SizedBox(height: 10),
                    Text(
                      l10n.fam_join_failed,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 15,
                        color: AppTokens.danger,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          BigButton(
            key: const Key('join_accept'),
            label: l10n.fam_join_accept,
            height: 76,
            onPressed: busy ? null : onAccept,
          ),
          Padding(
            padding: const EdgeInsets.only(top: 6, bottom: 18),
            child: _NotNowButton(
              label: l10n.fam_join_notNow,
              onPressed: onNotNow,
            ),
          ),
        ],
      ),
    );
  }
}

class _JoinAvatar extends StatelessWidget {
  const _JoinAvatar({required this.initial, required this.colorIndex});

  final String initial;
  final int colorIndex;

  @override
  Widget build(BuildContext context) {
    final c = AppTokens.avatars[colorIndex];
    return Container(
      width: 72,
      height: 72,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: c.bg,
        shape: BoxShape.circle,
        border: Border.all(color: AppTokens.bg, width: 4),
      ),
      child: ExcludeSemantics(
        child: Text(
          initial,
          style: TextStyle(
            fontSize: 30,
            fontWeight: FontWeight.w700,
            color: c.fg,
          ),
        ),
      ),
    );
  }
}

class _Bullet extends StatelessWidget {
  const _Bullet({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          ExcludeSemantics(child: Icon(icon, size: 26, color: AppTokens.green)),
          const SizedBox(width: 12),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 16))),
        ],
      ),
    );
  }
}
