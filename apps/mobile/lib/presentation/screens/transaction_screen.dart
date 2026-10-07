import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/providers.dart';

class TransactionScreen extends ConsumerStatefulWidget {
  const TransactionScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<TransactionScreen> createState() => _TransactionScreenState();
}

class _TransactionScreenState extends ConsumerState<TransactionScreen> {
  bool isExpense = true;
  final TextEditingController amountController = TextEditingController();
  final TextEditingController noteController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(isExpense ? 'Add Expense' : 'Add Income'),
        backgroundColor: isExpense ? Colors.red.shade800 : Colors.green.shade800,
        foregroundColor: Colors.white,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Toggle
            Row(
              children: [
                Expanded(
                  child: ChoiceChip(
                    label: const Center(child: Text("Expense")),
                    selected: isExpense,
                    onSelected: (val) => setState(() => isExpense = true),
                    selectedColor: Colors.red.shade100,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ChoiceChip(
                    label: const Center(child: Text("Income")),
                    selected: !isExpense,
                    onSelected: (val) => setState(() => isExpense = false),
                    selectedColor: Colors.green.shade100,
                  ),
                )
              ],
            ),
            const SizedBox(height: 24),
            
            TextField(
              controller: amountController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
              decoration: InputDecoration(
                prefixText: '৳ ',
                labelText: 'Amount',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 16),
            
            TextField(
              controller: noteController,
              decoration: InputDecoration(
                labelText: 'Note or Category',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const Spacer(),
            
            SizedBox(
              height: 56,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: isExpense ? Colors.red.shade800 : Colors.green.shade800,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () {
                  final amount = double.tryParse(amountController.text) ?? 0.0;
                  if (amount > 0) {
                    if (isExpense) {
                      ref.read(appStateProvider.notifier).addExpense(amount);
                    } else {
                      ref.read(appStateProvider.notifier).addIncome(amount);
                    }
                    Navigator.pop(context);
                  }
                },
                child: const Text('Save Transaction', style: TextStyle(fontSize: 18)),
              ),
            )
          ],
        ),
      ),
    );
  }
}
