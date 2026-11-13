// ignore_for_file: file_names
import 'package:amar_poribar/features/entry/ui/category_picker_screen.dart';
import 'package:amar_poribar/features/transactions/state/add_expense_controller.dart';

import '../features/transactions/add_expense_fixtures.dart';
import 'golden_config.dart';

void main() {
  goldenScreen(
    'A4_category_picker',
    const CategoryPickerScreen(
      args: CategoryPickerArgs(
        amountPaisa: 50000,
        caption: 'ক্যাশ · আজ',
        initialId: 'c-bazaar',
      ),
    ),
    overrides: [
      addCategoriesProvider.overrideWith((ref) async => kFixtureCategories),
    ],
  );
}
