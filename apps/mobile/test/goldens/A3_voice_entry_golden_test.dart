// ignore_for_file: file_names
import 'package:amar_poribar/features/entry/data/fake_entry_repository.dart';
import 'package:amar_poribar/features/entry/state/entry_controller.dart';
import 'package:amar_poribar/features/entry/ui/voice_entry_screen.dart';
import 'package:amar_poribar/features/transactions/data/fake_transaction_repository.dart';

import '../features/transactions/add_expense_fixtures.dart';
import 'golden_config.dart';

void main() {
  goldenScreen(
    'A3_voice_entry',
    const VoiceEntryScreen(initialText: 'আজ বাজারে আটশো পঞ্চাশ টাকা ক্যাশে'),
    overrides: [
      ...addExpenseOverrides(FakeTransactionRepository()),
      entryRepositoryProvider.overrideWithValue(FakeEntryRepository()),
      entryClockProvider.overrideWithValue(() => DateTime.utc(2026, 11, 9, 4)),
    ],
  );
}
