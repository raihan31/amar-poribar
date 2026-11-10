import 'dart:convert';

import 'package:amar_poribar/data/api/api_client.dart';
import 'package:amar_poribar/data/auth/session_manager.dart';
import 'package:amar_poribar/data/auth/token_store.dart';
import 'package:amar_poribar/features/voice/ui/voice_fallback_screen.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import '../../goldens/golden_config.dart';
import '../../helpers/fake_voice_service.dart';
import '../../helpers/pump_app.dart';
import 'voice_capability_test.dart' show noBangla;

class SignedIn extends AuthNotifier {
  SignedIn(ApiClient api)
      : super(
          api,
          SessionManager(
            store: MemoryTokenStore(),
            refresh: (_) async => throw UnimplementedError(),
          ),
        ) {
    state = const AuthState(
      loaded: true,
      token: 't',
      family: FamilyInfo('f1', 'Rahman', 'owner'),
    );
  }
}

ApiClient fakeApi(void Function(Map<String, dynamic>) onSent) => ApiClient(
      baseUrl: 'http://x',
      token: 't',
      client: MockClient((req) async {
        onSent(jsonDecode(req.body) as Map<String, dynamic>);
        return http.Response.bytes(
          utf8.encode(
            jsonEncode({
              'drafts': [
                {
                  'type': 'expense',
                  'amountPaisa': 85000,
                  'feePaisa': 0,
                  'occurredAt': '2026-11-09T10:00:00Z',
                  'categoryKey': 'bazaar',
                  'accountType': 'cash',
                  'note': 'bazar',
                  'counterparty': null,
                  'trxId': null,
                  'source': 'ai_text',
                  'confidence': 0.9,
                },
              ],
              'usedAi': false,
            }),
          ),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }),
    );

void main() {
  testWidgets(
    'explains, offers install, and typing "bazar 850 cash" makes a draft',
    (tester) async {
      Map<String, dynamic>? sent;
      final api = fakeApi((b) => sent = b);
      final voice = FakeVoiceService(capabilities: noBangla);
      await pumpApp(
        tester,
        const VoiceFallbackScreen(),
        overrides: [
          apiClientProvider.overrideWithValue(api),
          authProvider.overrideWith((ref) => SignedIn(api)),
          voiceServiceProvider.overrideWithValue(voice),
        ],
      );
      await tester.pumpAndSettle();

      expect(find.text('এই ফোনে বাংলা ভয়েস নেই'), findsOneWidget);
      expect(find.text('বাংলা ভয়েস ইনস্টল করুন'), findsOneWidget);

      await tester.tap(find.text('বাংলা ভয়েস ইনস্টল করুন'));
      await tester.pumpAndSettle();
      expect(voice.installOpens, 1);

      await tester.enterText(find.byType(TextField), 'bazar 850 cash');
      await tester.tap(find.byIcon(Icons.arrow_forward));
      await tester.pumpAndSettle();

      expect(sent!['text'], 'bazar 850 cash');
      expect(find.textContaining('৮৫০'), findsWidgets);
      expect(find.text('সংরক্ষণ'), findsOneWidget);
    },
  );

  goldenScreen(
    'D8_voice_fallback',
    const VoiceFallbackScreen(),
    overrides: [
      voiceServiceProvider
          .overrideWithValue(FakeVoiceService(capabilities: noBangla)),
    ],
  );
}
