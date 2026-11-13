import 'package:amar_poribar/core/money/money_format.dart' show toLatinDigits;
import 'package:amar_poribar/domain/models/enums.dart';
import 'package:flutter/foundation.dart';

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
      final amountStr =
          debitRegex.firstMatch(rawText)?.group(1)?.replaceAll(',', '');
      return ParsedBankTransaction(
        amount: double.tryParse(amountStr ?? '0') ?? 0,
        type: TransactionType.expense,
      );
    } else if (creditRegex.hasMatch(rawText)) {
      final amountStr =
          creditRegex.firstMatch(rawText)?.group(1)?.replaceAll(',', '');
      return ParsedBankTransaction(
        amount: double.tryParse(amountStr ?? '0') ?? 0,
        type: TransactionType.income,
      );
    }

    throw const FormatException('Could not parse DBBL transaction amount');
  }
}

/// bKash, Nagad or Rocket.
enum SmsProvider { bkash, nagad, rocket }

/// What the message says happened.
enum SmsKind {
  send('send', 'expense', 'Send Money'),
  payment('payment', 'expense', 'Payment'),
  bill('bill', 'expense', 'Bill Payment'),
  recharge('recharge', 'expense', 'Mobile Recharge'),
  cashOut('cash_out', 'transfer', 'Cash Out'),
  cashIn('cash_in', 'transfer', 'Cash In'),
  received('received', 'income', 'Money Received');

  const SmsKind(this.wire, this.type, this.note);
  final String wire;

  /// `expense`, `income` or `transfer`.
  final String type;
  final String note;
}

/// An entry read from an MFS message on the phone, with no AI call (FR-AI-02, AC-03).
/// The raw text is not kept: only these fields are.
class SmsDraft {
  const SmsDraft({
    required this.kind,
    required this.amountPaisa,
    required this.feePaisa,
    required this.counterpartyMasked,
    required this.trxId,
    required this.balancePaisa,
    required this.occurredAt,
    required this.provider,
    this.categoryKey,
  });

  final SmsKind kind;
  final int amountPaisa;
  final int feePaisa;

  /// Phone numbers keep only their last three digits ("01XXXXXX678").
  final String? counterpartyMasked;
  final String trxId;
  final int? balancePaisa;
  final DateTime occurredAt;
  final SmsProvider provider;

  /// Set when the message names the category (a recharge, a known biller).
  final String? categoryKey;

  String get type => kind.type;
  String get note => counterpartyMasked == null
      ? kind.note
      : '${kind.note} — $counterpartyMasked';
}

const _amount = r'(?:Tk|BDT|৳)\.?\s*([\d,]+(?:\.\d{1,2})?)';
final _amountRe = RegExp(_amount, caseSensitive: false);
final _trxRe = RegExp(
  r'\b(?:TrxID|TxnID|TxnId|Trx\s*ID|Txn\s*ID)\s*:?\s*([A-Z0-9]{6,20})\b',
  caseSensitive: false,
);
final _dateRe = RegExp(r'(\d{2})/(\d{2})/(\d{4})\s+(\d{2}):(\d{2})');
final _phoneRe = RegExp(r'(?:\+?88)?01[3-9]\d{5}(\d{3})');
final _billerRe = RegExp(
  r'Biller\s*:?\s*([A-Za-z][\w &.-]{1,40}?)(?=\s*(?:\.|,|Account|Acc|Amount|Bill|$))',
  caseSensitive: false,
);
final _labelledRe = RegExp(
  r'(?:Receiver|Sender|Merchant|Agent)\s*:?\s*([+\w][\w &.()-]{2,40}?)(?=\s*(?:\.|,|Ref|Amount|TxnID|TrxID|Fee|Balance|$))',
  caseSensitive: false,
);
final _toRe = _prepositionRe('to');
final _fromRe = _prepositionRe('from');

RegExp _prepositionRe(String word) => RegExp(
      '\\b$word\\s+([+\\w][\\w &.()-]{2,40}?)(?=\\s+(?:is\\s+)?(?:successful|Ref|Fee|Balance|TrxID)|[.,]|\$)',
      caseSensitive: false,
    );

const _billerCategory = <(String, String)>[
  (r'DESCO|DPDC|NESCO|BPDB|REB|Palli\s*Bidyut|WZPDCL|electric', 'electricity'),
  (r'Titas|Karnaphuli|Bakhrabad|Jalalabad|Paschimanchal|gas', 'gas'),
  (r'WASA|water', 'water'),
  (r'internet|broadband|Link3|Carnival|Amber|Dish|Akash', 'internet'),
];

SmsProvider? _provider(String sms) {
  if (RegExp(r'\bnagad\b', caseSensitive: false).hasMatch(sms) ||
      RegExp(r'\bTxnID\b').hasMatch(sms)) {
    return SmsProvider.nagad;
  }
  if (RegExp(r'\brocket\b|\bDBBL\b', caseSensitive: false).hasMatch(sms) ||
      RegExp(r'\bTxnId\b').hasMatch(sms)) {
    return SmsProvider.rocket;
  }
  if (RegExp(r'\bTrxID\b', caseSensitive: false).hasMatch(sms) ||
      RegExp(r'\bbkash\b', caseSensitive: false).hasMatch(sms)) {
    return SmsProvider.bkash;
  }
  return null;
}

SmsKind? _kind(String sms) {
  bool has(String p) => RegExp(p, caseSensitive: false).hasMatch(sms);
  if (has('recharge')) return SmsKind.recharge;
  if (has(r'bill\s+(?:successfully\s+)?paid|bill\s+payment|biller')) {
    return SmsKind.bill;
  }
  if (has(r'cash\s*out')) return SmsKind.cashOut;
  if (has(r'cash\s*in')) return SmsKind.cashIn;
  if (has(r'received|money\s+received')) return SmsKind.received;
  if (has('payment')) return SmsKind.payment;
  if (has(r'sent|send\s+money|money\s+sent')) return SmsKind.send;
  return null;
}

/// "2,000.00" -> 200000. Integer arithmetic only.
int _paisa(String s) {
  final parts = s.replaceAll(',', '').split('.');
  final taka = int.parse(parts[0]);
  final frac = parts.length > 1 ? parts[1].padRight(2, '0') : '00';
  return taka * 100 + int.parse(frac.substring(0, 2));
}

int? _amountAfter(String label, String sms) {
  final m =
      RegExp('$label\\s*:?\\s*$_amount', caseSensitive: false).firstMatch(sms);
  return m == null ? null : _paisa(m.group(1)!);
}

String _maskPhone(String text) =>
    text.replaceAllMapped(_phoneRe, (m) => '01XXXXXX${m.group(1)}');

String? _counterparty(String sms, SmsKind kind) {
  final biller = _billerRe.firstMatch(sms)?.group(1);
  if (biller != null) return biller.trim();
  final labelled = _labelledRe.firstMatch(sms)?.group(1);
  if (labelled != null) return _maskPhone(labelled.trim());
  final m =
      (kind == SmsKind.received ? _fromRe : _toRe).firstMatch(sms)?.group(1);
  return m == null ? null : _maskPhone(m.trim());
}

String? _categoryFor(SmsKind kind, String? counterparty) {
  if (kind == SmsKind.recharge) return 'mobile_recharge';
  if (kind == SmsKind.bill && counterparty != null) {
    for (final (pattern, key) in _billerCategory) {
      if (RegExp(pattern, caseSensitive: false).hasMatch(counterparty)) {
        return key;
      }
    }
  }
  return null;
}

/// Reads a bKash, Nagad or Rocket message. Returns null when the text is not one, so the
/// caller can fall back to the AI. Mirrors `parseMfsSms` in `packages/ai`.
SmsDraft? parseMfsSms(String raw, {DateTime? now}) {
  final sms = toLatinDigits(raw).replaceAll(RegExp(r'\s+'), ' ').trim();
  final provider = _provider(sms);
  final kind = _kind(sms);
  final trxId = _trxRe.firstMatch(sms)?.group(1);
  if (provider == null || kind == null || trxId == null) return null;

  final first = _amountRe.firstMatch(sms)?.group(1);
  final amount =
      _amountAfter('Amount', sms) ?? (first == null ? null : _paisa(first));
  if (amount == null || amount <= 0) return null;

  final d = _dateRe.firstMatch(sms);
  final at = d == null
      ? (now ?? DateTime.now())
      : DateTime.parse(
          '${d[3]}-${d[2]}-${d[1]}T${d[4]}:${d[5]}:00+06:00',
        );
  final who = _counterparty(sms, kind);
  return SmsDraft(
    kind: kind,
    amountPaisa: amount,
    feePaisa: _amountAfter('Fee', sms) ?? 0,
    counterpartyMasked: who,
    trxId: trxId,
    balancePaisa: _amountAfter('Balance', sms),
    occurredAt: at,
    provider: provider,
    categoryKey: _categoryFor(kind, who),
  );
}

class SmsParserEngine {
  final List<BankParserStrategy> _strategies = [
    DbblParserStrategy(),
    // Add more bank strategies here (EBL, CityBank, BRAC, etc.)
  ];

  /// bKash, Nagad and Rocket templates (no network, no AI).
  SmsDraft? parseMfs(String raw, {DateTime? now}) => parseMfsSms(raw, now: now);

  ParsedBankTransaction? tryParse(String sender, String rawText) {
    for (final strategy in _strategies) {
      if (strategy.canParse(sender, rawText)) {
        try {
          return strategy.parse(sender, rawText);
        } catch (e) {
          // If a parser throws, gracefully continue or return null
          debugPrint('Parser ${strategy.bankIdentifier} failed: $e');
          return null;
        }
      }
    }
    return null; // Could not identify the bank or format
  }
}
