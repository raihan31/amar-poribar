import '../../domain/models/api/budget.dart';
import '../../domain/models/api/common.dart';
import 'api_transport.dart';

/// Budgets, festival budgets and recurring templates.
class BudgetApi {
  final ApiTransport _t;
  BudgetApi(this._t);

  /// This month's budgets with spend and 80%/100% level (or [month], `YYYY-MM`).
  Future<BudgetList> budgets(String familyId, {String? month}) async =>
      BudgetList.fromJson(
        await _t.send(
          'GET',
          '/v1/families/$familyId/budgets${month == null ? '' : '?month=$month'}',
        ) as Map<String, dynamic>,
      );

  /// `PUT /budgets?month=` with `{budgets: [{categoryId, limitPaisa}]}` (Owner/Admin only).
  Future<void> setBudgets(
    String familyId,
    Map<String, dynamic> body, {
    String? month,
  }) async {
    await _t.send(
      'PUT',
      '/v1/families/$familyId/budgets${month == null ? '' : '?month=$month'}',
      body: body,
    );
  }

  Future<List<FestivalBudget>> festivalBudgets(String familyId) async =>
      decodeList(
        await _t.send('GET', '/v1/families/$familyId/festival-budgets'),
        FestivalBudget.fromJson,
      );

  Future<List<Recurring>> recurring(String familyId) async => decodeList(
        await _t.send('GET', '/v1/families/$familyId/recurring'),
        Recurring.fromJson,
      );
}
