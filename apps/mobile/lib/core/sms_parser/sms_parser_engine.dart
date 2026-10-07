import 'package:amar_poribar/domain/models/enums.dart';

class ParsedBankTransaction {
  final double amount;
  final TransactionType type;
  final String? accountHint;
  final String? merchant;
  final DateTime? explicitlyParsedDate;

  ParsedBankTransaction({
    required this.amount,
    required this.type,
    this.accountHint,
    this.merchant,
    this.explicitlyParsedDate,
  });
}

abstract class BankParserStrategy {
  /// The identifiable name of the bank or format (e.g., 'DBBL', 'EBL')
  String get bankIdentifier;

  /// Returns true if this parser believes it can parse the raw text
  bool canParse(String sender, String rawText);

  /// Extracts the relevant data from the raw SMS text
  ParsedBankTransaction parse(String sender, String rawText);
}

// Example Parser for DBBL (Dutch-Bangla Bank Limited)
class DbblParserStrategy implements BankParserStrategy {
  @override
  String get bankIdentifier => 'DBBL';

  @override
  bool canParse(String sender, String rawText) {
    return sender.toUpperCase().contains('DBBL') || sender.contains('16216');
  }

  @override
  ParsedBankTransaction parse(String sender, String rawText) {
    // A mock regex parsing DBBL expense string.
    // E.g., "Tk 500.00 has been debited from A/C **1234 on 03-Oct for POS Purchase at SWAPNO."
    
    final debitRegex = RegExp(r'Tk\s+([\d,.]+)\s+has been debited');
    final creditRegex = RegExp(r'Tk\s+([\d,.]+)\s+has been credited');
    
    if (debitRegex.hasMatch(rawText)) {
      final amountStr = debitRegex.firstMatch(rawText)?.group(1)?.replaceAll(',', '');
      return ParsedBankTransaction(
        amount: double.tryParse(amountStr ?? '0') ?? 0,
        type: TransactionType.expense,
      );
    } else if (creditRegex.hasMatch(rawText)) {
      final amountStr = creditRegex.firstMatch(rawText)?.group(1)?.replaceAll(',', '');
      return ParsedBankTransaction(
        amount: double.tryParse(amountStr ?? '0') ?? 0,
        type: TransactionType.income,
      );
    }

    throw FormatException('Could not parse DBBL transaction amount');
  }
}

class SmsParserEngine {
  final List<BankParserStrategy> _strategies = [
    DbblParserStrategy(),
    // Add more bank strategies here (EBL, CityBank, BRAC, etc.)
  ];

  ParsedBankTransaction? tryParse(String sender, String rawText) {
    for (final strategy in _strategies) {
      if (strategy.canParse(sender, rawText)) {
        try {
          return strategy.parse(sender, rawText);
        } catch (e) {
          // If a parser throws, gracefully continue or return null
          print('Parser ${strategy.bankIdentifier} failed: $e');
          return null;
        }
      }
    }
    return null; // Could not identify the bank or format
  }
}
