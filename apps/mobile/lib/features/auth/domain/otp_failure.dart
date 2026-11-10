/// Why a sign-in step failed (T-MOB-15 shows each one).
sealed class OtpFailure {
  const OtpFailure();
}

class Invalid extends OtpFailure {
  final int attemptsLeft;
  const Invalid(this.attemptsLeft);
}

class Expired extends OtpFailure {
  const Expired();
}

class RateLimited extends OtpFailure {
  final Duration retryAfter;
  const RateLimited(this.retryAfter);
}

class Network extends OtpFailure {
  const Network();
}

class Server extends OtpFailure {
  const Server();
}

/// Thrown by an `AuthRepository`; carries the typed [failure].
class OtpError implements Exception {
  final OtpFailure failure;
  const OtpError(this.failure);

  @override
  String toString() => 'OtpError($failure)';
}
