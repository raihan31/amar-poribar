import '../../domain/models/api/report.dart';
import 'api_transport.dart';

class ReportApi {
  final ApiTransport _t;
  ReportApi(this._t);

  Future<ReportSummary> summary(String familyId, {String? month}) async =>
      ReportSummary.fromJson(
        await _t.send(
          'GET',
          '/v1/families/$familyId/reports/summary${month == null ? '' : '?month=$month'}',
        ) as Map<String, dynamic>,
      );
}
