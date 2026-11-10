import 'dart:io';

import 'package:amar_poribar/data/api/api_exception.dart';
import 'package:amar_poribar/data/api/api_transport.dart';
import 'package:amar_poribar/data/api/auth_api.dart';
import 'package:amar_poribar/data/api/family_api.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';

import 'api_test_helpers.dart';

void main() {
  group('AuthApi', () {
    test('requestOtp posts the phone and returns devCode', () async {
      final r = Recorder({'devCode': '123456'});
      expect(await AuthApi(r.transport()).requestOtp('017'), '123456');
      expect(r.method, 'POST');
      expect(r.url, '/v1/auth/otp/request');
      expect(r.sent, {'phone': '017'});
    });

    test('verifyOtp keeps the access token on the transport', () async {
      final r = Recorder({'accessToken': 'tok'});
      final t = r.transport();
      await AuthApi(t).verifyOtp('017', '111111');
      expect(r.url, '/v1/auth/otp/verify');
      expect(r.sent, {'phone': '017', 'code': '111111'});
      expect(t.token, 'tok');
    });

    test('profile, consent and device calls use the SRS routes', () async {
      final r = Recorder(null, status: 204);
      final a = AuthApi(r.transport());
      await a.updateProfile({'locale': 'bn'});
      expect([r.method, r.url], ['PATCH', '/v1/me']);
      await a.acceptConsent('privacy', 'v1');
      expect(r.url, '/v1/me/consents');
      await a.registerDevice('d1', {'platform': 'android'});
      expect([r.method, r.url], ['PUT', '/v1/me/devices/d1']);
      await a.removeDevice('d1');
      expect(r.method, 'DELETE');
      await a.logout();
      expect(r.url, '/v1/auth/logout');
    });

    test('error body maps to ApiException', () async {
      final r = Recorder(
        {
          'error': {
            'code': 'otp_invalid',
            'message': 'Wrong code',
            'details': {'left': 2},
          },
        },
        status: 400,
      );
      await expectLater(
        AuthApi(r.transport()).verifyOtp('017', '0'),
        throwsA(
          isA<ApiException>()
              .having((e) => e.status, 'status', 400)
              .having((e) => e.code, 'code', 'otp_invalid')
              .having((e) => e.message, 'message', 'Wrong code'),
        ),
      );
    });
  });

  group('FamilyApi', () {
    test('me decodes user and families', () async {
      final r = Recorder({
        'user': {
          'bnDigits': true,
          'createdAt': kTime,
          'id': kId,
          'locale': 'bn',
          'name': null,
          'phone': '+8801700000001',
          'updatedAt': kTime,
        },
        'families': [
          {'id': kId, 'name': 'রহিম পরিবার', 'role': 'owner'},
        ],
      });
      final me = await FamilyApi(r.transport()).me();
      expect(r.url, '/v1/me');
      expect(me.families.single.name, 'রহিম পরিবার');
    });

    test('createFamily posts the name', () async {
      final r = Recorder({
        'aiQuotaMonth': 100,
        'createdAt': kTime,
        'createdBy': kId,
        'currency': 'BDT',
        'id': kId,
        'name': 'A',
        'plan': 'free',
        'updatedAt': kTime,
      });
      final f = await FamilyApi(r.transport()).createFamily('A');
      expect(r.method, 'POST');
      expect(r.url, '/v1/families');
      expect(r.sent, {'name': 'A'});
      expect(f.plan, 'free');
    });

    test('members, invite, accept and remove', () async {
      final r = Recorder([
        {'name': null, 'phone': '+88017', 'role': 'member', 'userId': kId},
      ]);
      final a = FamilyApi(r.transport());
      expect((await a.members('f1')).single.role, 'member');
      expect(r.url, '/v1/families/f1/members');
      r.body = {'token': 'abc'};
      await a.invite('f1', {'phone': '017'});
      expect([r.method, r.url], ['POST', '/v1/families/f1/invites']);
      r.body = null;
      r.status = 204;
      await a.acceptInvite('abc');
      expect(r.url, '/v1/invites/abc/accept');
      await a.removeMember('f1', 'u1');
      expect([r.method, r.url], ['DELETE', '/v1/families/f1/members/u1']);
    });

    test('offline maps to status 0', () async {
      final t = ApiTransport(
        MockClient((_) async => throw const SocketException('down')),
        'http://x',
      );
      await expectLater(
        FamilyApi(t).me(),
        throwsA(isA<ApiException>().having((e) => e.status, 'status', 0)),
      );
    });
  });
}
