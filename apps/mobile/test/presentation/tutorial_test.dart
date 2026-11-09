import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:amar_poribar/core/speech/tutorial.dart';
import 'package:amar_poribar/core/speech/voice_service.dart';
import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:amar_poribar/presentation/providers/providers.dart';
import 'package:amar_poribar/presentation/screens/tutorial_screen.dart';

class FakeVoice implements VoiceService {
  final spoken = <String>[];
  @override
  Future<bool> init() async => true;
  @override
  bool get listening => false;
  @override
  Future<void> listen(void Function(String text) onResult,
      {void Function(String error)? onError}) async {}
  @override
  Future<void> stopListening() async {}
  @override
  Future<void> speak(String text) async => spoken.add(text);
  @override
  Future<void> stopSpeaking() async {}
}

void main() {
  testWidgets(
      'reads each step aloud, can replay, and remembers that it was seen',
      (tester) async {
    final voice = FakeVoice();
    final store = await LocalStore.open(AppDatabase.memory());
    await tester.pumpWidget(ProviderScope(
      overrides: [
        voiceServiceProvider.overrideWithValue(voice),
        localStoreProvider.overrideWithValue(store),
      ],
      child: MaterialApp(
        routes: {'/ai-entry': (_) => const Scaffold(body: Text('AI ENTRY'))},
        home: const TutorialScreen(),
      ),
    ));
    await tester.pump();
    expect(voice.spoken, [kTutorialSteps[0]]);
    expect(find.text(kTutorialSteps[0]), findsOneWidget);

    await tester.tap(find.text('পরের ধাপ'));
    await tester.pump();
    expect(voice.spoken.last, kTutorialSteps[1]);

    await tester.tap(find.text('আবার শুনুন'));
    await tester.pump();
    expect(voice.spoken.last, kTutorialSteps[1]);

    await tester.tap(find.text('পেছনে'));
    await tester.pump();
    expect(voice.spoken.last, kTutorialSteps[0]);

    for (var i = 0; i < kTutorialSteps.length - 1; i++) {
      await tester.tap(find.text('পরের ধাপ'));
      await tester.pump();
    }
    expect(find.text('শুরু করুন'), findsOneWidget);
    await tester.tap(find.text('শুরু করুন'));
    await tester.pumpAndSettle();

    expect(find.text('AI ENTRY'), findsOneWidget);
    expect(await store.getMeta(tutorialDoneKey), '1');
  });

  testWidgets('can be skipped, which also counts as seen', (tester) async {
    final store = await LocalStore.open(AppDatabase.memory());
    await tester.pumpWidget(ProviderScope(
      overrides: [
        voiceServiceProvider.overrideWithValue(FakeVoice()),
        localStoreProvider.overrideWithValue(store),
      ],
      child: MaterialApp(
        routes: {'/ai-entry': (_) => const Scaffold(body: Text('AI ENTRY'))},
        home: const TutorialScreen(),
      ),
    ));
    await tester.pump();
    await tester.tap(find.text('বাদ দিন'));
    await tester.pumpAndSettle();
    expect(find.text('AI ENTRY'), findsOneWidget);
    expect(await store.getMeta(tutorialDoneKey), '1');
  });
}
