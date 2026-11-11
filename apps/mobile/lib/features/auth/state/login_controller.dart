import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/money/money_format.dart';
import '../../../presentation/providers/auth_provider.dart';
import '../data/auth_repository.dart';
import '../domain/otp_failure.dart';
import 'session_owner.dart';

enum LoginPhase { phone, code }

final RegExp _bdPhone = RegExp(r'^(?:\+?88)?01[3-9]\d{8}$');

/// Latin digits, no spaces or dashes.
String cleanPhone(String raw) =>
    toLatinDigits(raw).replaceAll(RegExp(r'[\s-]'), '');

/// `+8801XXXXXXXXX`, or null when [raw] is not a Bangladeshi mobile number (FR-AUTH-02).
String? normalizePhone(String raw) {
  final p = cleanPhone(raw);
  if (!_bdPhone.hasMatch(p)) return null;
  return '+88${p.substring(p.length - 11)}';
}

class LoginState {
  final String phone;
  final String code;
  final LoginPhase phase;
  final bool busy;
  final bool phoneInvalid;
  final OtpFailure? error;
  final int resendSecondsLeft;

  /// How many codes were asked for on this number (shown in the hourly-limit note).
  final int codesRequested;

  /// A different number signed in on a phone that holds someone else's data: ask first.
  final bool otherUserPending;

  const LoginState({
    this.phone = '',
    this.code = '',
    this.phase = LoginPhase.phone,
    this.busy = false,
    this.phoneInvalid = false,
    this.error,
    this.resendSecondsLeft = 0,
    this.codesRequested = 0,
    this.otherUserPending = false,
  });

  /// The code input and "ঢুকুন" are locked: no tries left, or a rate-limit wait is running.
  bool get locked {
    final e = error;
    return (e is Invalid && e.attemptsLeft == 0) || e is RateLimited;
  }

  LoginState copyWith({
    String? phone,
    String? code,
    LoginPhase? phase,
    bool? busy,
    bool? phoneInvalid,
    OtpFailure? error,
    bool clearError = false,
    int? resendSecondsLeft,
    int? codesRequested,
    bool? otherUserPending,
  }) =>
      LoginState(
        phone: phone ?? this.phone,
        code: code ?? this.code,
        phase: phase ?? this.phase,
        busy: busy ?? this.busy,
        phoneInvalid: phoneInvalid ?? this.phoneInvalid,
        error: clearError ? null : (error ?? this.error),
        resendSecondsLeft: resendSecondsLeft ?? this.resendSecondsLeft,
        codesRequested: codesRequested ?? this.codesRequested,
        otherUserPending: otherUserPending ?? this.otherUserPending,
      );
}

/// Where "now" comes from; tests override it with a `FakeClock`.
final loginClockProvider = Provider<DateTime Function()>((_) => DateTime.now);

/// Runs after the tokens are stored: loads the profile and families so the router can move on.
final loginSignedInProvider = Provider<Future<void> Function()>(
  (ref) => () => ref.read(authProvider.notifier).completeSignIn(),
);

final loginControllerProvider =
    StateNotifierProvider<LoginController, LoginState>(
  (ref) => LoginController(
    ref.watch(authRepositoryProvider),
    ref.watch(loginClockProvider),
    ref.watch(loginSignedInProvider),
    ref.watch(sessionOwnerProvider),
  ),
);

class LoginController extends StateNotifier<LoginState> {
  LoginController(this._repo, this._now, this._onSignedIn, [this._owner])
      : super(const LoginState());

  final AuthRepository _repo;
  final DateTime Function() _now;
  final Future<void> Function() _onSignedIn;
  final SessionOwner? _owner;

  Timer? _timer;
  DateTime? _resendAt;
  bool signedIn = false;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void setPhone(String v) =>
      state = state.copyWith(phone: v, phoneInvalid: false, clearError: true);

  void setCode(String v) {
    final digits = toLatinDigits(v).replaceAll(RegExp(r'\D'), '');
    state = state.copyWith(
      code: digits.length > 6 ? digits.substring(0, 6) : digits,
      clearError: true,
    );
  }

  void _startCountdown(int seconds) {
    _timer?.cancel();
    _resendAt = _now().add(Duration(seconds: seconds));
    state = state.copyWith(resendSecondsLeft: seconds);
    if (seconds <= 0) return;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  void _tick() {
    final at = _resendAt;
    if (at == null || !mounted) return;
    final ms = at.difference(_now()).inMilliseconds;
    final left = ms <= 0 ? 0 : (ms / 1000).ceil();
    // A rate-limit panel goes away by itself when its wait is over.
    final over = left == 0 && state.error is RateLimited;
    state = state.copyWith(resendSecondsLeft: left, clearError: over);
    if (left == 0) _timer?.cancel();
  }

  /// Shows [f]. A rate limit also starts its countdown; no tries left empties the code input.
  void _fail(OtpFailure f) {
    if (f is RateLimited) {
      final s = f.retryAfter.inSeconds;
      _startCountdown(s < 1 ? 1 : s);
    }
    state = state.copyWith(
      busy: false,
      error: f,
      code: f is Invalid && f.attemptsLeft == 0 ? '' : null,
    );
  }

  Future<void> submitPhone() async {
    if (state.busy) return;
    final phone = normalizePhone(state.phone);
    if (phone == null) {
      state = state.copyWith(phoneInvalid: true);
      return;
    }
    state = state.copyWith(busy: true, clearError: true);
    try {
      final c = await _repo.requestOtp(phone);
      if (!mounted) return;
      _startCountdown(c.resendAfterSeconds);
      state = state.copyWith(
        phone: phone,
        phase: LoginPhase.code,
        code: '',
        busy: false,
        codesRequested: state.codesRequested + 1,
      );
    } on OtpError catch (e) {
      if (mounted) _fail(e.failure);
    }
  }

  Future<void> submitCode() async {
    if (state.busy || state.code.length != 6) return;
    state = state.copyWith(busy: true, clearError: true);
    try {
      await _repo.verifyOtp(state.phone, state.code);
      if (await _owner?.isOtherUser() ?? false) {
        if (mounted) {
          state = state.copyWith(busy: false, otherUserPending: true);
        }
        return;
      }
      await _finishSignIn(wipe: false);
    } on OtpError catch (e) {
      if (mounted) _fail(e.failure);
    }
  }

  Future<void> _finishSignIn({required bool wipe}) async {
    await _owner?.claim(wipe: wipe);
    await _onSignedIn();
    signedIn = true;
    if (mounted) state = state.copyWith(busy: false, otherUserPending: false);
  }

  /// Answer to the other-number question. [wipe] true deletes this phone's earlier data.
  Future<void> answerOtherUser({required bool wipe}) async {
    if (!state.otherUserPending) return;
    if (wipe) {
      state = state.copyWith(busy: true, otherUserPending: false);
      await _finishSignIn(wipe: true);
    } else {
      await _owner?.decline();
      if (mounted) state = LoginState(phone: state.phone);
    }
  }

  /// Asks for another code. [force] skips the resend countdown: the error panel's
  /// "নতুন কোড পাঠান" is allowed while a wrong or expired code is showing, but never during
  /// a rate-limit wait.
  Future<void> resend({bool force = false}) async {
    if (state.busy) return;
    if (state.error is RateLimited && state.resendSecondsLeft > 0) return;
    if (!force && state.resendSecondsLeft > 0) return;
    state = state.copyWith(busy: true, clearError: true);
    try {
      final c = await _repo.requestOtp(state.phone);
      if (!mounted) return;
      _startCountdown(c.resendAfterSeconds);
      state = state.copyWith(
        busy: false,
        code: '',
        codesRequested: state.codesRequested + 1,
      );
    } on OtpError catch (e) {
      if (mounted) _fail(e.failure);
    }
  }

  void changeNumber() {
    _timer?.cancel();
    state = LoginState(phone: state.phone);
  }
}
