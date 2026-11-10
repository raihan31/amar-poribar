import 'package:amar_poribar/core/speech/tutorial.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:amar_poribar/presentation/providers/providers.dart';
import 'package:amar_poribar/presentation/screens/tutorial_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../helpers/fake_voice_service.dart';
import '../helpers/pump_app.dart';

GoRouter _router() => GoRouter(
      routes: [
        GoRoute(path: '/', builder: (_, __) => const TutorialScreen()),
        GoRoute(
          path: '/home',
          builder: (_, __) => const Scaffold(body: Text('HOME')),
        ),
      ],
    );

void main() {
  testWidgets(
      'reads each step aloud, can replay, and remembers that it was seen',
      (tester) async {
    await pumpApp(tester, const SizedBox(), router: _router());
    final voice =
        appContainer(tester).read(voiceServiceProvider) as FakeVoiceService;
    final store = appContainer(tester).read(localStoreProvider);
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

    expect(find.text('HOME'), findsOneWidget);
    expect(await store.getMeta(tutorialDoneKey), '1');
  });

  testWidgets('can be skipped, which also counts as seen', (tester) async {
    await pumpApp(tester, const SizedBox(), router: _router());
    final store = appContainer(tester).read(localStoreProvider);
    await tester.pump();
    await tester.tap(find.text('বাদ দিন'));
    await tester.pumpAndSettle();
    expect(find.text('HOME'), findsOneWidget);
    expect(await store.getMeta(tutorialDoneKey), '1');
  });
}
