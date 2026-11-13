import 'package:amar_poribar/core/speech/tutorial.dart';
import 'package:amar_poribar/features/onboarding/ui/tutorial_screen.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:amar_poribar/presentation/providers/providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../../helpers/fake_voice_service.dart';
import '../../helpers/pump_app.dart';

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
      'reads each step aloud once, shows the counter, can replay and go back',
      (tester) async {
    await pumpApp(tester, const SizedBox(), router: _router());
    final voice =
        appContainer(tester).read(voiceServiceProvider) as FakeVoiceService;
    final store = appContainer(tester).read(localStoreProvider);
    await tester.pump();
    expect(kTutorialSteps.length, 4);
    expect(voice.spoken, [kTutorialSteps[0]]);
    expect(find.text('১ / ৪'), findsOneWidget);
    expect(find.text(kTutorialSteps[0]), findsOneWidget);

    await tester.tap(find.text('পরের ধাপ'));
    await tester.pump();
    expect(voice.spoken, [kTutorialSteps[0], kTutorialSteps[1]]);
    expect(find.text('২ / ৪'), findsOneWidget);
    expect(find.text('মাইক চেপে বলুন: বাজার আটশো টাকা'), findsOneWidget);

    await tester.tap(find.text('আবার শুনুন'));
    await tester.pump();
    expect(voice.spoken.last, kTutorialSteps[1]);
    expect(voice.spoken.length, 3);

    await tester.tap(find.text('পেছনে'));
    await tester.pump();
    expect(voice.spoken.last, kTutorialSteps[0]);
    expect(find.text('১ / ৪'), findsOneWidget);

    for (final n in ['২', '৩', '৪']) {
      await tester.tap(find.byKey(const Key('tutorial_next')));
      await tester.pump();
      expect(find.text('$n / ৪'), findsOneWidget);
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
