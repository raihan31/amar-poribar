// ignore_for_file: file_names
import 'package:amar_poribar/features/transactions/data/fake_transaction_repository.dart';
import 'package:amar_poribar/features/transactions/ui/transactions_screen.dart';
import 'package:amar_poribar/ui/bottom_tabs.dart';
import 'package:flutter/material.dart';

import '../features/transactions/transactions_fixtures.dart';
import 'golden_config.dart';

/// Board: Txns.dc.html. The shell's tab bar is added so the whole 390 x 844 board is compared.
Widget _screen() => Scaffold(
      body: const TransactionsScreen(),
      bottomNavigationBar: AppBottomTabs(index: 2, onSelect: (_) {}),
    );

void main() {
  final repo = FakeTransactionRepository(
    boardRows()..removeWhere((r) => r.id == 'oct'),
  );
  goldenScreen('B1_transactions', _screen(), overrides: listOverrides(repo));
  goldenScreen(
    'B1_transactions',
    _screen(),
    overrides: listOverrides(repo),
    dark: true,
  );
}
