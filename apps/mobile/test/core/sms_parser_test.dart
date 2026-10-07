import 'package:flutter_test/flutter_test.dart';
import 'package:amar_poribar/core/sms_parser/sms_parser_engine.dart';
import 'package:amar_poribar/domain/models/enums.dart';

void main() {
  group('SMS Parser Strategy Tests', () {
    late SmsParserEngine parserEngine;

    setUp(() {
      parserEngine = SmsParserEngine();
    });

    test('DBBL Parser correctly extracts Debit amount and Expense type', () {
      const sender = "16216";
      const rawText = "Tk 500.00 has been debited from A/C **1234 on 03-Oct for POS Purchase at SWAPNO. Available Bal Tk 15,000.00";

      final result = parserEngine.tryParse(sender, rawText);

      expect(result, isNotNull);
      expect(result!.amount, 500.0);
      expect(result.type, TransactionType.expense);
    });

    test('DBBL Parser correctly extracts Credit amount and Income type', () {
      const sender = "DBBL";
      const rawText = "Tk 12,000.00 has been credited to A/C **1234 on 04-Oct from Salary AC. Available Bal Tk 27,000.00";

      final result = parserEngine.tryParse(sender, rawText);

      expect(result, isNotNull);
      expect(result!.amount, 12000.0);
      expect(result.type, TransactionType.income);
    });

    test('Unregistered Bank Sender returns null gracefully', () {
      const sender = "RandomBank";
      const rawText = "Your account was debited Tk 500.";

      final result = parserEngine.tryParse(sender, rawText);

      // We only have DBBL registered in the mock engine currently
      expect(result, isNull);
    });
    
    test('Invalid text payload returns null instead of crashing', () {
      const sender = "DBBL";
      const rawText = "Dear user, please update your KYC immediately.";

      final result = parserEngine.tryParse(sender, rawText);

      expect(result, isNull);
    });
  });
}
