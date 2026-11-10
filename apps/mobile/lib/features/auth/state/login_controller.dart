import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/money/money_format.dart';
import '../../../presentation/providers/auth_provider.dart';
import '../data/auth_repository.dart';
import '../domain/otp_failure.dart';

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

  const LoginState({
    this.phone = '',
    this.code = '',
    this.phase = LoginPhase.phone,
    this.busy = false,
    this.phoneInvalid = false,
    this.error,
    this.resendSecondsLeft = 0,
  });

  LoginState copyWith({
    String? phone,
    String? code,
    LoginPhase? phase,
    bool? busy,
    bool? phoneInvalid,
    OtpFailure? error,
    bool clearError = false,
    int? resendSecondsLeft,
  }) =>
      LoginState(
        phone: phone ?? this.phone,
        code: code ?? this.code,
        phase: phase ?? this.phase,
        busy: busy ?? this.busy,
        phoneInvalid: phoneInvalid ?? this.phoneInvalid,
        error: clearError ? null : (error ?? this.error),
        resendSecondsLeft: resendSecondsLeft ?? this.resendSecondsLeft,
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
  ),
);

class LoginController extends StateNotifier<LoginState> {
  LoginController(this._repo, this._now, this._onSignedIn)
      : super(const LoginState());

  final AuthRepository _repo;
  final DateTime Function() _now;
  final Future<void> Function() _onSignedIn;

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
    state = state.copyWith(resendSecondsLeft: left);
    if (left == 0) _timer?.cancel();
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
      );
    } on OtpError catch (e) {
      if (mounted) state = state.copyWith(busy: false, error: e.failure);
    }
  }

  Future<void> submitCode() async {
    if (state.busy || state.code.length != 6) return;
    state = state.copyWith(busy: true, clearError: true);
    try {
      await _repo.verifyOtp(state.phone, state.code);
      await _onSignedIn();
      signedIn = true;
      if (mounted) state = state.copyWith(busy: false);
    } on OtpError catch (e) {
      if (mounted) state = state.copyWith(busy: false, error: e.failure);
    }
  }

  Future<void> resend() async {
    if (state.busy || state.resendSecondsLeft > 0) return;
    state = state.copyWith(busy: true, clearError: true);
    try {
      final c = await _repo.requestOtp(state.phone);
      if (!mounted) return;
      _startCountdown(c.resendAfterSeconds);
      state = state.copyWith(busy: false, code: '');
    } on OtpError catch (e) {
      if (mounted) state = state.copyWith(busy: false, error: e.failure);
    }
  }

  void changeNumber() {
    _timer?.cancel();
    state = LoginState(phone: state.phone);
  }
}
