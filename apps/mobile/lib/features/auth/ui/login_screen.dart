import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/redirects.dart';
import '../../../core/l10n/l10n_x.dart';
import '../../../core/money/money_format.dart';
import '../../../core/money/numeral_style_provider.dart';
import '../../../core/theme/tokens.dart';
import '../../../ui/big_button.dart';
import '../domain/otp_failure.dart';
import '../state/login_controller.dart';

export '../state/login_controller.dart' show LoginPhase;

/// A1: phone number, then the 6-digit code (FR-AUTH-01, -02). Board: Login.dc.html.
/// Routes `/login` (phone step) and `/login/code` (code step) show this widget; what it
/// draws follows the controller's phase.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key, this.phase = LoginPhase.phone, this.from});

  final LoginPhase phase;
  final String? from;

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _phoneCtl = TextEditingController();
  final _codeCtl = TextEditingController();
  final _codeFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    _phoneCtl.text = ref.read(loginControllerProvider).phone;
  }

  @override
  void dispose() {
    _phoneCtl.dispose();
    _codeCtl.dispose();
    _codeFocus.dispose();
    super.dispose();
  }

  String _route(String base) => widget.from == null
      ? base
      : '$base?from=${Uri.encodeQueryComponent(widget.from!)}';

  void _goTo(String location) {
    final router = GoRouter.maybeOf(context);
    if (router != null) router.go(location);
  }

  Future<void> _submit() async {
    final c = ref.read(loginControllerProvider.notifier);
    if (ref.read(loginControllerProvider).phase == LoginPhase.phone) {
      await c.submitPhone();
      if (mounted &&
          ref.read(loginControllerProvider).phase == LoginPhase.code) {
        _goTo(_route(Routes.loginCode));
      }
    } else {
      await c.submitCode();
      if (mounted && c.signedIn) {
        final from = widget.from;
        final safe =
            from != null && from.startsWith('/') && !from.startsWith('//');
        _goTo(safe ? from : Routes.home);
      }
    }
  }

  Future<void> _resend() => ref.read(loginControllerProvider.notifier).resend();

  void _changeNumber() {
    ref.read(loginControllerProvider.notifier).changeNumber();
    _codeCtl.clear();
    _goTo(_route(Routes.login));
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final s = ref.watch(loginControllerProvider);
    final style = ref.watch(numeralStyleProvider);
    String digits(String v) =>
        style == NumeralStyle.bangla ? toBanglaDigits(v) : v;
    final onCode = s.phase == LoginPhase.code;

    ref.listen(loginControllerProvider.select((x) => x.phase), (prev, next) {
      if (next == LoginPhase.code) _codeFocus.requestFocus();
    });
    if (_codeCtl.text != s.code) _codeCtl.text = s.code;

    final canSubmit = !s.busy && (!onCode || s.code.length == 6);

    return Scaffold(
      backgroundColor: AppTokens.bg,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, box) => SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: box.maxHeight),
              child: IntrinsicHeight(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 40),
                    _Header(
                      title: l.auth_login_title,
                      tagline: l.auth_login_tagline,
                    ),
                    const SizedBox(height: 44),
                    Text(
                      l.auth_login_phoneLabel,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 10),
                    _phoneField(s, onCode, digits),
                    const SizedBox(height: 8),
                    if (s.phoneInvalid)
                      Text(
                        l.auth_login_phoneInvalid,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: AppTokens.dangerInk,
                        ),
                      )
                    else
                      Text(
                        l.auth_login_phoneHint,
                        style: const TextStyle(
                          fontSize: 14,
                          color: AppTokens.muted,
                        ),
                      ),
                    if (onCode) ...[
                      const SizedBox(height: 22),
                      Text(
                        l.auth_login_codeLabel,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 10),
                      _codeBoxes(s, digits),
                      const SizedBox(height: 10),
                      _resendRow(s, digits),
                    ],
                    if (s.error != null) ...[
                      const SizedBox(height: 10),
                      Text(
                        _errorText(context, s.error!),
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: AppTokens.dangerInk,
                        ),
                      ),
                    ],
                    const Spacer(),
                    const SizedBox(height: 24),
                    BigButton(
                      label: l.auth_login_submit,
                      height: 72,
                      onPressed: canSubmit ? _submit : null,
                    ),
                    Padding(
                      padding: const EdgeInsets.only(top: 12, bottom: 28),
                      child: Text(
                        l.auth_login_helpFooter,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 14,
                          color: AppTokens.muted,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  String _errorText(BuildContext context, OtpFailure f) => context
      .l10n.auth_login_failed; // T-MOB-15 gives each failure its own panel

  Widget _phoneField(
    LoginState s,
    bool locked,
    String Function(String) digits,
  ) {
    final l = context.l10n;
    return Container(
      height: 68,
      decoration: BoxDecoration(
        color: AppTokens.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: s.phoneInvalid ? AppTokens.danger : AppTokens.green,
          width: 3,
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          const Text(
            '+৮৮',
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w600,
              color: AppTokens.muted,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: MergeSemantics(
              child: Semantics(
                child: TextField(
                  expands: true,
                  maxLines: null,
                  textAlignVertical: TextAlignVertical.center,
                  controller: _phoneCtl,
                  enabled: !locked,
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.done,
                  autofillHints: const [AutofillHints.telephoneNumber],
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9০-৯+\s-]')),
                  ],
                  style: const TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w600,
                  ),
                  decoration: InputDecoration(
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    disabledBorder: InputBorder.none,
                    filled: false,
                    // Invisible; gives the field its spoken name.
                    labelText: l.auth_login_phoneSemantics,
                    labelStyle: const TextStyle(color: Colors.transparent),
                    floatingLabelStyle:
                        const TextStyle(color: Colors.transparent),
                    floatingLabelBehavior: FloatingLabelBehavior.auto,
                  ),
                  onChanged:
                      ref.read(loginControllerProvider.notifier).setPhone,
                  onSubmitted: (_) => _submit(),
                ),
              ),
            ),
          ),
          if (locked)
            TextButton(
              onPressed: _changeNumber,
              style: TextButton.styleFrom(minimumSize: const Size(48, 48)),
              child: Text(
                l.auth_login_changeNumber,
                style:
                    const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
              ),
            ),
        ],
      ),
    );
  }

  Widget _codeBoxes(LoginState s, String Function(String) digits) {
    final active = s.code.length < 6 ? s.code.length : -1;
    return SizedBox(
      height: 64,
      child: Stack(
        children: [
          ExcludeSemantics(
            child: Row(
              children: [
                for (var i = 0; i < 6; i++) ...[
                  if (i > 0) const SizedBox(width: 8),
                  Expanded(
                    child: Container(
                      height: 64,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: AppTokens.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: i == active
                              ? AppTokens.amber
                              : i < s.code.length
                                  ? AppTokens.green
                                  : AppTokens.inputBorder,
                          width: i == active ? 3 : 2,
                        ),
                      ),
                      child: i < s.code.length
                          ? Text(
                              digits(s.code[i]),
                              style: const TextStyle(
                                fontSize: 28,
                                fontWeight: FontWeight.w700,
                              ),
                            )
                          : null,
                    ),
                  ),
                ],
              ],
            ),
          ),
          // One hidden field drives the six boxes, so SMS autofill fills them all.
          Positioned.fill(
            child: MergeSemantics(
              child: Semantics(
                child: TextField(
                  controller: _codeCtl,
                  focusNode: _codeFocus,
                  autofocus: true,
                  keyboardType: TextInputType.number,
                  autofillHints: const [AutofillHints.oneTimeCode],
                  maxLength: 6,
                  showCursor: false,
                  enableInteractiveSelection: false,
                  style: const TextStyle(color: Colors.transparent),
                  cursorColor: Colors.transparent,
                  decoration: InputDecoration(
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    disabledBorder: InputBorder.none,
                    filled: false,
                    counterText: '',
                    labelText: context.l10n.auth_login_codeSemantics,
                    labelStyle: const TextStyle(color: Colors.transparent),
                    floatingLabelStyle:
                        const TextStyle(color: Colors.transparent),
                    floatingLabelBehavior: FloatingLabelBehavior.auto,
                  ),
                  onChanged: ref.read(loginControllerProvider.notifier).setCode,
                  onSubmitted: (_) => _submit(),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _resendRow(LoginState s, String Function(String) digits) {
    final l = context.l10n;
    final left = s.resendSecondsLeft;
    final time =
        digits('${left ~/ 60}:${(left % 60).toString().padLeft(2, '0')}');
    return Row(
      children: [
        Text(
          '${l.auth_login_resendQuestion} ',
          style: const TextStyle(fontSize: 15, color: AppTokens.muted),
        ),
        TextButton(
          onPressed: left > 0 || s.busy ? null : _resend,
          style: TextButton.styleFrom(
            minimumSize: const Size(48, 48),
            padding: EdgeInsets.zero,
            tapTargetSize: MaterialTapTargetSize.padded,
          ),
          child: Text(
            left > 0 ? l.auth_login_resend(time) : l.auth_login_resendNow,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: left > 0 ? AppTokens.muted : AppTokens.green,
            ),
          ),
        ),
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.title, required this.tagline});

  final String title;
  final String tagline;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 84,
          height: 84,
          decoration: BoxDecoration(
            color: AppTokens.green,
            borderRadius: BorderRadius.circular(28),
          ),
          child: const ExcludeSemantics(
            child: Icon(Icons.home_outlined, size: 48, color: AppTokens.white),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          title,
          style: const TextStyle(
            fontSize: 34,
            fontWeight: FontWeight.w700,
            color: AppTokens.green,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          tagline,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 17, color: AppTokens.muted),
        ),
      ],
    );
  }
}
