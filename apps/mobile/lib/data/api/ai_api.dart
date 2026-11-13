import '../../domain/models/api/draft.dart';
import '../../domain/models/api/report.dart';
import 'api_transport.dart';

class AiApi {
  final ApiTransport _t;
  AiApi(this._t);

  /// Text or a pasted MFS SMS to drafts (SRS FR-AI-01, FR-AI-02).
  Future<ParseResponse> parse(
    String familyId,
    String text, {
    DateTime? now,
  }) async =>
      ParseResponse.fromJson(
        await _t.send(
          'POST',
          '/v1/families/$familyId/ai/parse',
          body: {
            'text': text,
            'now': (now ?? DateTime.now()).toUtc().toIso8601String(),
          },
        ) as Map<String, dynamic>,
      );

  Future<MonthlySummary> summary(
    String familyId, {
    String locale = 'bn',
    String? month,
  }) async =>
      MonthlySummary.fromJson(
        await _t.send(
          'GET',
          '/v1/families/$familyId/ai/summary?locale=$locale'
              '${month == null ? '' : '&month=$month'}',
        ) as Map<String, dynamic>,
      );

  Future<Map<String, dynamic>> ask(String familyId, String question) async =>
      await _t.send(
        'POST',
        '/v1/families/$familyId/ai/ask',
        body: {'question': question},
      ) as Map<String, dynamic>;
}
