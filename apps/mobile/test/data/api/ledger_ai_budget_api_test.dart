import 'package:amar_poribar/data/api/ai_api.dart';
import 'package:amar_poribar/data/api/budget_api.dart';
import 'package:amar_poribar/data/api/ledger_api.dart';
import 'package:amar_poribar/data/api/report_api.dart';
import 'package:amar_poribar/data/api/sync_api.dart';
import 'package:flutter_test/flutter_test.dart';

import 'api_test_helpers.dart';

Map<String, dynamic> _category() => {
      'familyId': kId,
      'icon': null,
      'id': kId,
      'isHidden': false,
      'key': 'bazaar',
      'kind': 'expense',
      'nameBn': 'বাজার',
      'nameEn': 'Bazaar',
    };

void main() {
  group('LedgerApi', () {
    test('categories GET', () async {
      final r = Recorder([_category()]);
      final c = await LedgerApi(r.transport()).categories('f1');
      expect([r.method, r.url], ['GET', '/v1/families/f1/categories']);
      expect(c.single.nameBn, 'বাজার');
    });

    test('accounts GET and create POST', () async {
      final acc = {
        'archivedAt': null,
        'createdAt': kTime,
        'familyId': kId,
        'id': kId,
        'name': 'Cash',
        'openingBalancePaisa': 0,
        'ownerUserId': null,
        'type': 'cash',
        'updatedAt': kTime,
      };
      final r = Recorder([acc]);
      final a = LedgerApi(r.transport());
      expect((await a.accounts('f1')).single.type, 'cash');
      expect(r.url, '/v1/families/f1/accounts');
      r.body = acc;
      await a.createAccount('f1', {'name': 'Cash', 'type': 'cash'});
      expect(r.method, 'POST');
      expect(r.sent, {'name': 'Cash', 'type': 'cash'});
    });

    test('transaction list, patch and delete', () async {
      final r = Recorder(<Object>[]);
      final a = LedgerApi(r.transport());
      await a.transactions('f1', limit: 5);
      expect(r.url, '/v1/families/f1/transactions?limit=5');
      r.body = null;
      r.status = 204;
      await a.deleteTransaction('f1', 't1');
      expect([r.method, r.url], ['DELETE', '/v1/families/f1/transactions/t1']);
    });
  });

  group('AiApi', () {
    test('parse sends text and reads drafts', () async {
      final r = Recorder({
        'drafts': [
          {
            'type': 'expense',
            'amountPaisa': 85000,
            'feePaisa': 0,
            'occurredAt': kTime,
            'categoryKey': 'bazaar',
            'accountType': 'cash',
            'note': 'বাজার',
            'counterparty': null,
            'trxId': null,
            'source': 'ai_text',
            'confidence': 0.9,
          },
        ],
        'usedAi': true,
      });
      final p = await AiApi(r.transport()).parse('f1', 'বাজার ৮৫০');
      expect([r.method, r.url], ['POST', '/v1/families/f1/ai/parse']);
      expect((r.sent! as Map)['text'], 'বাজার ৮৫০');
      expect(p.drafts.single.amountPaisa, 85000);
    });

    test('summary passes the locale', () async {
      final r = Recorder({
        'locale': 'en',
        'month': '2026-10',
        'speechText': 's',
        'text': 't',
        'usedAi': false,
      });
      final s = await AiApi(r.transport()).summary('f1', locale: 'en');
      expect(r.url, '/v1/families/f1/ai/summary?locale=en');
      expect(s.usedAi, false);
    });
  });

  group('BudgetApi', () {
    test('budgets with month', () async {
      final r = Recorder({'budgets': <Object>[], 'month': '2026-10'});
      final b = await BudgetApi(r.transport()).budgets('f1', month: '2026-10');
      expect(r.url, '/v1/families/f1/budgets?month=2026-10');
      expect(b.month, '2026-10');
    });

    test('setBudgets uses PUT', () async {
      final r = Recorder(null, status: 204);
      await BudgetApi(r.transport()).setBudgets('f1', {'limitPaisa': 1});
      expect(r.method, 'PUT');
      expect(r.sent, {'limitPaisa': 1});
    });
  });

  group('ReportApi', () {
    test('summary GET', () async {
      final r = Recorder({
        'byAccount': <Object>[],
        'byCategory': <Object>[],
        'byMember': <Object>[],
        'expensePaisa': 1,
        'incomePaisa': 2,
        'month': '2026-10',
        'previous': {'expensePaisa': 0, 'incomePaisa': 0, 'month': '2026-09'},
      });
      final s = await ReportApi(r.transport()).summary('f1', month: '2026-10');
      expect(r.url, '/v1/families/f1/reports/summary?month=2026-10');
      expect(s.expensePaisa, 1);
    });
  });

  group('SyncApi', () {
    test('sync wraps changes under transactions', () async {
      final r = Recorder({
        'applied': 0,
        'changes': {'transactions': <Object>[]},
        'cursor': '3',
        'more': false,
        'rejected': [
          {'id': null, 'reason': 'bad_clock'},
        ],
      });
      final s = await SyncApi(r.transport())
          .sync('f1', 'n1', null, <Map<String, dynamic>>[]);
      expect([r.method, r.url], ['POST', '/v1/families/f1/sync']);
      expect(r.sent, {
        'nodeId': 'n1',
        'cursor': null,
        'changes': {'transactions': <Object>[]},
      });
      expect(s.cursor, '3');
      expect(s.rejected.single.reason, 'bad_clock');
    });
  });
}
