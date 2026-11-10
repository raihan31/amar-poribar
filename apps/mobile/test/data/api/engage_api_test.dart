import 'package:amar_poribar/data/api/billing_api.dart';
import 'package:amar_poribar/data/api/comms_api.dart';
import 'package:amar_poribar/data/api/lending_api.dart';
import 'package:amar_poribar/data/api/notification_api.dart';
import 'package:amar_poribar/data/api/privacy_api.dart';
import 'package:amar_poribar/data/api/shopping_api.dart';
import 'package:flutter_test/flutter_test.dart';

import 'api_test_helpers.dart';

void main() {
  test('CommsApi conversations, messages page, nudge reply, ice', () async {
    final r = Recorder([
      {'id': 'c1', 'familyId': 'f1', 'kind': 'group', 'unread': 2},
    ]);
    final a = CommsApi(r.transport());
    expect((await a.conversations('f1')).single.unread, 2);
    expect(r.url, '/v1/families/f1/conversations');

    r.body = {
      'items': [
        {
          'id': 'm1',
          'conversationId': 'c1',
          'senderId': 'u1',
          'kind': 'text',
          'body': 'হ্যালো',
          'createdAt': kTime,
        },
      ],
      'nextCursor': 'abc',
    };
    final page = await a.messages('c1', cursor: 'x');
    expect(r.url, '/v1/conversations/c1/messages?cursor=x');
    expect(page.nextCursor, 'abc');
    expect(page.items.single.body, 'হ্যালো');

    r.body = null;
    r.status = 204;
    await a.replyNudge('n1', 'coming');
    expect(r.url, '/v1/nudges/n1/reply');
    expect(r.sent, {'reply': 'coming'});

    r.status = 200;
    r.body = {
      'iceServers': [
        {
          'urls': ['stun:x'],
        },
      ],
      'ttlSeconds': 600,
    };
    expect((await a.iceServers()).ttlSeconds, 600);
    expect(r.url, '/v1/rtc/ice');
  });

  test('NotificationApi inbox and preferences', () async {
    final r = Recorder({
      'items': [
        {
          'id': 'i1',
          'kind': 'budget',
          'title': 't',
          'body': 'b',
          'createdAt': kTime,
        },
      ],
      'nextCursor': null,
    });
    final a = NotificationApi(r.transport());
    expect((await a.inbox()).items.single.id, 'i1');
    expect(r.url, '/v1/inbox');
    r.body = null;
    r.status = 204;
    await a.markRead(['i1']);
    expect(r.method, 'POST');
    expect(r.url, '/v1/inbox/read');
    expect((r.sent! as Map)['ids'], ['i1']);
    await a.clearInbox();
    expect(r.method, 'DELETE');
    r.status = 200;
    r.body = {
      'kinds': {'budget': true},
      'hidePresence': false,
    };
    final p = await a.preferences();
    expect(r.url, '/v1/me/notification-preferences');
    await a.savePreferences(p);
    expect(r.method, 'PUT');
  });

  test('ShoppingApi lists and items', () async {
    final r = Recorder([
      {'id': 'l1', 'familyId': 'f1', 'name': 'বাজার'},
    ]);
    final a = ShoppingApi(r.transport());
    expect((await a.lists('f1')).single.items, isEmpty);
    expect(r.url, '/v1/families/f1/shopping-lists');
    r.body = {
      'id': 'i1',
      'listId': 'l1',
      'name': 'চাল',
      'position': 0,
    };
    await a.addItem('f1', 'l1', {'name': 'চাল'});
    expect(r.url, '/v1/families/f1/shopping-lists/l1/items');
    r.body = null;
    r.status = 204;
    await a.toExpense('f1', 'l1');
    expect(r.url, '/v1/families/f1/shopping-lists/l1/to-expense');
  });

  test('LendingApi list, repay, delete', () async {
    final r = Recorder([
      {
        'id': 'd1',
        'familyId': 'f1',
        'direction': 'lent',
        'personName': 'করিম',
        'amountPaisa': 100000,
        'date': '2026-10-01',
      },
    ]);
    final a = LendingApi(r.transport());
    expect((await a.list('f1')).single.amountPaisa, 100000);
    r.body = null;
    r.status = 204;
    await a.repay('f1', 'd1', 5000);
    expect(r.url, '/v1/families/f1/dhar/d1/repayments');
    expect(r.sent, {'amountPaisa': 5000});
    await a.delete('f1', 'd1');
    expect(r.method, 'DELETE');
  });

  test('BillingApi plans, subscription, invoices', () async {
    final r = Recorder([
      {
        'code': 'free',
        'nameBn': 'ফ্রি',
        'nameEn': 'Free',
        'pricePaisa': 0,
        'memberLimit': 5,
        'aiQuotaMonth': 100,
      },
    ]);
    final a = BillingApi(r.transport());
    expect((await a.plans()).single.code, 'free');
    expect(r.url, '/v1/plans');
    r.body = {
      'planCode': 'free',
      'status': 'active',
      'memberLimit': 5,
      'aiQuotaMonth': 100,
    };
    expect((await a.subscription('f1')).aiUsedMonth, 0);
    expect(r.url, '/v1/families/f1/subscription');
    r.body = <Object>[];
    await a.invoices('f1');
    expect(r.url, '/v1/families/f1/subscription/invoices');
  });

  test('PrivacyApi export and erasure', () async {
    final r = Recorder({
      'id': 'p1',
      'kind': 'export',
      'status': 'queued',
      'requestedAt': kTime,
    });
    final a = PrivacyApi(r.transport());
    expect((await a.requestExport()).kind, 'export');
    expect([r.method, r.url], ['POST', '/v1/me/export']);
    await a.exportStatus('p1');
    expect(r.url, '/v1/me/export/p1');
    await a.requestErasure();
    expect(r.url, '/v1/me/erasure');
    r.body = null;
    r.status = 204;
    await a.cancelErasure();
    expect([r.method, r.url], ['DELETE', '/v1/me/erasure']);
  });
}
