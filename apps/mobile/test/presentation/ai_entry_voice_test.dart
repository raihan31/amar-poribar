import 'dart:convert';

import 'package:amar_poribar/data/api/api_client.dart';
import 'package:amar_poribar/data/auth/session_manager.dart';
import 'package:amar_poribar/data/auth/token_store.dart';
import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:amar_poribar/presentation/providers/providers.dart';
import 'package:amar_poribar/presentation/screens/ai_entry_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import '../helpers/fake_voice_service.dart';
import '../helpers/pump_app.dart';

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

void main() {
  testWidgets('speaking an expense parses it, marks it voice and reads it back',
      (tester) async {
    late Map<String, dynamic> sent;
    final api = ApiClient(
      baseUrl: 'http://x',
      token: 't',
      client: MockClient((req) async {
        sent = jsonDecode(req.body) as Map<String, dynamic>;
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
                  'note': 'বাজার',
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
    final voice = FakeVoiceService(listen: ['আজ বাজারে আটশো পঞ্চাশ টাকা']);
    final store = await LocalStore.open(AppDatabase.memory());

    await pumpApp(
      tester,
      const AiEntryScreen(),
      overrides: [
        apiClientProvider.overrideWithValue(api),
        authProvider.overrideWith((ref) => SignedIn(api)),
        voiceServiceProvider.overrideWithValue(voice),
        localStoreProvider.overrideWithValue(store),
      ],
    );

    await tester.tap(find.text('চাপ দিয়ে বলুন'));
    await tester.pumpAndSettle();

    expect(sent['text'], 'আজ বাজারে আটশো পঞ্চাশ টাকা');
    expect(find.textContaining('বাজার ও মুদি'), findsOneWidget);
    expect(voice.spoken, ['বাজার ও মুদি খাতে আটশো পঞ্চাশ টাকা খরচ। ঠিক আছে?']);
  });

  testWidgets(
      'typing offline queues the text; opening the app online turns it into a draft to confirm',
      (tester) async {
    final store = await LocalStore.open(AppDatabase.memory());
    var online = false;
    final api = ApiClient(
      baseUrl: 'http://x',
      token: 't',
      client: MockClient((req) async {
        if (!online) throw Exception('no network');
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
                  'note': 'বাজার',
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

    Future<void> app() => pumpApp(
          tester,
          const AiEntryScreen(),
          overrides: [
            apiClientProvider.overrideWithValue(api),
            authProvider.overrideWith((ref) => SignedIn(api)),
            voiceServiceProvider.overrideWithValue(FakeVoiceService()),
            localStoreProvider.overrideWithValue(store),
          ],
        );

    // Offline: the text is kept, not lost.
    await app();
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'আজ বাজারে ৮৫০ টাকা');
    await tester.tap(find.text('বুঝে নাও'));
    await tester.pumpAndSettle();
    expect(find.textContaining('অপেক্ষায় আছে'), findsOneWidget);
    expect((await store.pending()).single.status, 'queued');

    // Online again (app reopened): it is understood, and waits for the user's OK.
    online = true;
    await tester.pumpWidget(const SizedBox());
    await app();
    await tester.pumpAndSettle();
    expect(find.textContaining('অপেক্ষায় আছে'), findsNothing);
    expect(find.textContaining('বাজার ও মুদি'), findsOneWidget);
    expect(
      await store.recent(),
      isEmpty,
      reason: 'not saved until the user confirms',
    );
  });
}
