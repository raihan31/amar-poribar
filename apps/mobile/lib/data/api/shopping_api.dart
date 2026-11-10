import '../../domain/models/api/common.dart';
import '../../domain/models/api/engage.dart';
import 'api_transport.dart';

class ShoppingApi {
  final ApiTransport _t;
  ShoppingApi(this._t);

  Future<List<ShoppingList>> lists(String familyId) async => decodeList(
        await _t.send('GET', '/v1/families/$familyId/shopping-lists'),
        ShoppingList.fromJson,
      );

  Future<ShoppingList> createList(String familyId, String name) async =>
      ShoppingList.fromJson(
        await _t.send(
          'POST',
          '/v1/families/$familyId/shopping-lists',
          body: {'name': name},
        ) as Map<String, dynamic>,
      );

  Future<ShoppingItem> addItem(
    String familyId,
    String listId,
    Map<String, dynamic> body,
  ) async =>
      ShoppingItem.fromJson(
        await _t.send(
          'POST',
          '/v1/families/$familyId/shopping-lists/$listId/items',
          body: body,
        ) as Map<String, dynamic>,
      );

  Future<void> toExpense(String familyId, String listId) async {
    await _t.send(
      'POST',
      '/v1/families/$familyId/shopping-lists/$listId/to-expense',
    );
  }
}
