import 'package:json_annotation/json_annotation.dart';

part 'common.g.dart';

/// `{error:{code,message,details?}}` (SRS 5.2).
@JsonSerializable(explicitToJson: true)
class ApiErrorBody {
  final ApiErrorDetail error;
  const ApiErrorBody({required this.error});
  factory ApiErrorBody.fromJson(Map<String, dynamic> j) =>
      _$ApiErrorBodyFromJson(j);
  Map<String, dynamic> toJson() => _$ApiErrorBodyToJson(this);
}

@JsonSerializable(explicitToJson: true)
class ApiErrorDetail {
  final String code;
  final String message;
  final Object? details;
  const ApiErrorDetail({
    required this.code,
    required this.message,
    this.details,
  });
  factory ApiErrorDetail.fromJson(Map<String, dynamic> j) =>
      _$ApiErrorDetailFromJson(j);

  /// `details` is left out when absent, as the API does.
  Map<String, dynamic> toJson() {
    final m = _$ApiErrorDetailToJson(this);
    if (details == null) m.remove('details');
    return m;
  }
}

/// List responses: `{items,nextCursor}`.
class Page<T> {
  final List<T> items;
  final String? nextCursor;
  const Page(this.items, this.nextCursor);

  factory Page.fromJson(
    Map<String, dynamic> j,
    T Function(Map<String, dynamic>) item,
  ) =>
      Page(
        [
          for (final x in j['items'] as List<dynamic>)
            item(x as Map<String, dynamic>),
        ],
        j['nextCursor'] as String?,
      );
}

/// Decodes a JSON list of objects.
List<T> decodeList<T>(
  Object? json,
  T Function(Map<String, dynamic>) item,
) =>
    [for (final x in json! as List<dynamic>) item(x as Map<String, dynamic>)];
