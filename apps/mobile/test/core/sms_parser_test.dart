import 'dart:convert';
import 'dart:io';

import 'package:amar_poribar/core/sms_parser/sms_parser_engine.dart';
import 'package:amar_poribar/domain/models/enums.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('SMS Parser Strategy Tests', () {
    late SmsParserEngine parserEngine;

    setUp(() {
      parserEngine = SmsParserEngine();
    });

    test('DBBL Parser correctly extracts Debit amount and Expense type', () {
      const sender = '16216';
      const rawText =
          'Tk 500.00 has been debited from A/C **1234 on 03-Oct for POS Purchase at SWAPNO. Available Bal Tk 15,000.00';

      final result = parserEngine.tryParse(sender, rawText);

      expect(result, isNotNull);
      expect(result!.amount, 500.0);
      expect(result.type, TransactionType.expense);
    });

    test('DBBL Parser correctly extracts Credit amount and Income type', () {
      const sender = 'DBBL';
      const rawText =
          'Tk 12,000.00 has been credited to A/C **1234 on 04-Oct from Salary AC. Available Bal Tk 27,000.00';

      final result = parserEngine.tryParse(sender, rawText);

      expect(result, isNotNull);
      expect(result!.amount, 12000.0);
      expect(result.type, TransactionType.income);
    });

    test('Unregistered Bank Sender returns null gracefully', () {
      const sender = 'RandomBank';
      const rawText = 'Your account was debited Tk 500.';

      final result = parserEngine.tryParse(sender, rawText);

      // We only have DBBL registered in the mock engine currently
      expect(result, isNull);
    });

    test('Invalid text payload returns null instead of crashing', () {
      const sender = 'DBBL';
      const rawText = 'Dear user, please update your KYC immediately.';

      final result = parserEngine.tryParse(sender, rawText);

      expect(result, isNull);
    });
  });

  group('MFS templates (shared fixtures)', () {
    final engine = SmsParserEngine();
    final dir = Directory('../../packages/shared/test-vectors/sms');
    final files = dir.listSync().whereType<File>().toList()
      ..sort((a, b) => a.path.compareTo(b.path));

    test('fixtures exist for all three providers', () {
      expect(
        files.map((f) => f.uri.pathSegments.last),
        containsAll(['bkash.json', 'nagad.json', 'rocket.json']),
      );
    });

    for (final f in files) {
      final doc = jsonDecode(f.readAsStringSync()) as Map<String, dynamic>;
      for (final c in doc['cases'] as List<dynamic>) {
        final m = c as Map<String, dynamic>;
        test('${doc['provider']}: ${m['name']}', () {
          final d = engine.parseMfs(m['text'] as String);
          expect(d, isNotNull);
          final e = m['expected'] as Map<String, dynamic>;
          expect(d!.kind.wire, e['kind']);
          expect(d.amountPaisa, e['amountPaisa']);
          expect(d.feePaisa, e['feePaisa']);
          expect(d.counterpartyMasked, e['counterpartyMasked']);
          expect(d.trxId, e['trxId']);
          expect(d.balancePaisa, e['balancePaisa']);
          expect(
            d.occurredAt.isAtSameMomentAs(
              DateTime.parse(e['occurredAt'] as String),
            ),
            isTrue,
          );
          expect(d.provider.name, e['provider']);
          if (e['categoryKey'] != null) {
            expect(d.categoryKey, e['categoryKey']);
          }
        });
      }
    }

    test('the bKash send-money example is exact (AC-03)', () {
      final d = engine.parseMfs(
        'You have sent Tk 2,000.00 to 01XXXXX-789. Fee Tk 0.00. Balance Tk 8,450.00. TrxID 9K4L2M7N at 10/11/2026 14:32',
      )!;
      expect(d.amountPaisa, 200000);
      expect(d.trxId, '9K4L2M7N');
      expect(d.feePaisa, 0);
    });

    test('shared parseMfsSms table still passes', () {
      final doc = jsonDecode(
        File('../../packages/shared/test-vectors/sms-parser.json')
            .readAsStringSync(),
      ) as Map<String, dynamic>;
      for (final c in doc['cases'] as List<dynamic>) {
        final m = c as Map<String, dynamic>;
        final d = engine.parseMfs(m['text'] as String);
        final e = m['expected'] as Map<String, dynamic>?;
        final why = m['name'] as String;
        if (e == null) {
          expect(d, isNull, reason: why);
          continue;
        }
        expect(d, isNotNull, reason: why);
        if (e['amountPaisa'] != null) {
          expect(d!.amountPaisa, e['amountPaisa'], reason: why);
        }
        if (e['feePaisa'] != null) {
          expect(d!.feePaisa, e['feePaisa'], reason: why);
        }
        if (e['trxId'] != null) expect(d!.trxId, e['trxId'], reason: why);
        if (e['counterparty'] != null) {
          expect(d!.counterpartyMasked, e['counterparty'], reason: why);
        }
        if (e['categoryKey'] != null) {
          expect(d!.categoryKey, e['categoryKey'], reason: why);
        }
        if (e['type'] != null) expect(d!.type, e['type'], reason: why);
        if (e['accountType'] != null) {
          expect(d!.provider.name, e['accountType'], reason: why);
        }
        if (e['occurredAt'] != null) {
          expect(
            d!.occurredAt.isAtSameMomentAs(
              DateTime.parse(e['occurredAt'] as String),
            ),
            isTrue,
            reason: why,
          );
        }
      }
    });

    test('plain text and bank SMS are not MFS templates', () {
      expect(engine.parseMfs('bazaar 850 cash'), isNull);
      expect(engine.parseMfs('Dear user, update your KYC.'), isNull);
    });
  });
}
