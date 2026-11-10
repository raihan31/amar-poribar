/// Error from apps/api: `{error:{code,message,details}}` mapped to fields.
class ApiException implements Exception {
  final int status;
  final String message;
  final String? code;
  final Object? details;
  ApiException(this.status, this.message, {this.code, this.details});

  bool get isUnauthorized => status == 401;

  @override
  String toString() => message;
}
