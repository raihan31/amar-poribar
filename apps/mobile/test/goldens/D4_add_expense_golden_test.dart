// ignore_for_file: file_names
import 'package:amar_poribar/features/transactions/data/fake_transaction_repository.dart';
import 'package:amar_poribar/features/transactions/ui/add_expense_screen.dart';

import '../features/transactions/add_expense_fixtures.dart';
import 'golden_config.dart';

void main() {
  goldenScreen(
    'D4_add_expense',
    const AddExpenseScreen(),
    overrides: addExpenseOverrides(FakeTransactionRepository()),
  );
}
