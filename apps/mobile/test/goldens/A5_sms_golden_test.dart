// ignore_for_file: file_names
import 'package:amar_poribar/features/entry/data/fake_entry_repository.dart';
import 'package:amar_poribar/features/entry/state/entry_controller.dart';
import 'package:amar_poribar/features/entry/ui/sms_paste_screen.dart';
import 'package:amar_poribar/features/transactions/data/fake_transaction_repository.dart';

import '../features/transactions/add_expense_fixtures.dart';
import 'golden_config.dart';

void main() {
  goldenScreen(
    'A5_sms',
    const SmsPasteScreen(
      initialText:
          'You have sent Tk 2,000.00 to 01XXXXX-789. Fee Tk 0.00. Balance Tk 8,450.00. TrxID 9K4L2M7N at 10/11/2026 14:32',
    ),
    overrides: [
      ...addExpenseOverrides(FakeTransactionRepository()),
      entryRepositoryProvider.overrideWithValue(FakeEntryRepository()),
      entryClockProvider.overrideWithValue(() => DateTime.utc(2026, 11, 10, 9)),
    ],
  );
}
