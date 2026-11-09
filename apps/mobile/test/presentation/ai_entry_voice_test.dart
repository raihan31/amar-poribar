import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:amar_poribar/core/speech/voice_service.dart';
import 'package:amar_poribar/data/api/api_client.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:amar_poribar/presentation/screens/ai_entry_screen.dart';

class FakeVoice implements VoiceService {
  final String heard;
  final List<String> spoken = [];
  FakeVoice(this.heard);

  @override
  Future<bool> init() async => true;
  @override
  bool get listening => false;
  @override
  Future<void> listen(void Function(String text) onResult, {void Function(String error)? onError}) async => onResult(heard);
  @override
  Future<void> stopListening() async {}
  @override
  Future<void> speak(String text) async => spoken.add(text);
  @override
  Future<void> stopSpeaking() async {}
}

class SignedIn extends AuthNotifier {
  SignedIn(super.api) {
    state = const AuthState(loaded: true, token: 't', family: FamilyInfo('f1', 'Rahman', 'owner'));
  }
}

void main() {
  testWidgets('speaking an expense parses it, marks it voice and reads it back', (tester) async {
    late Map<String, dynamic> sent;
    final api = ApiClient(
      baseUrl: 'http://x',
      token: 't',
      client: MockClient((req) async {
        sent = jsonDecode(req.body) as Map<String, dynamic>;
        return http.Response.bytes(
          utf8.encode(jsonEncode({
            'drafts': [
              {
                'type': 'expense', 'amountPaisa': 85000, 'feePaisa': 0, 'occurredAt': '2026-11-09T10:00:00Z',
                'categoryKey': 'bazaar', 'accountType': 'cash', 'note': 'বাজার', 'counterparty': null,
                'trxId': null, 'source': 'ai_text', 'confidence': 0.9,
              },
            ],
            'usedAi': false,
          })),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }),
    );
    final voice = FakeVoice('আজ বাজারে আটশো পঞ্চাশ টাকা');

    await tester.pumpWidget(ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        authProvider.overrideWith((ref) => SignedIn(api)),
        voiceServiceProvider.overrideWithValue(voice),
      ],
      child: const MaterialApp(home: AiEntryScreen()),
    ));

    await tester.tap(find.text('চাপ দিয়ে বলুন'));
    await tester.pumpAndSettle();

    expect(sent['text'], 'আজ বাজারে আটশো পঞ্চাশ টাকা');
    expect(find.textContaining('বাজার ও মুদি'), findsOneWidget);
    expect(voice.spoken, ['বাজার ও মুদি খাতে আটশো পঞ্চাশ টাকা খরচ। ঠিক আছে?']);
  });
}
