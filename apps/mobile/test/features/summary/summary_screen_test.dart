import 'package:amar_poribar/features/home/state/home_providers.dart';
import 'package:amar_poribar/features/summary/data/fake_summary_repository.dart';
import 'package:amar_poribar/features/summary/data/summary_repository.dart';
import 'package:amar_poribar/features/summary/state/summary_providers.dart';
import 'package:amar_poribar/features/summary/ui/summary_screen.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fake_voice_service.dart';
import '../../helpers/pump_app.dart';

final _now = DateTime.utc(2026, 11, 9, 12);

List<Override> _over(SummaryRepository r) => [
      summaryRepositoryProvider.overrideWithValue(r),
      homeClockProvider.overrideWithValue(() => _now),
    ];

Future<void> _settle(WidgetTester t) async {
  await t.pump();
  await t.pump(const Duration(milliseconds: 50));
}

const _footnote = 'সংখ্যাগুলো আপনার হিসাব থেকে নেওয়া, এআই বানায়নি।';

void main() {
  testWidgets('shows the amounts with digits and the footnote', (t) async {
    await pumpApp(
      t,
      const SummaryScreen(),
      overrides: _over(FakeSummaryRepository()),
    );
    await _settle(t);
    expect(find.text('এ মাস কেমন গেল?'), findsOneWidget);
    expect(find.textContaining('৳ ৪২,৫০০', findRichText: true), findsOneWidget);
    expect(find.text('নভেম্বর ২০২৬'), findsOneWidget);
    expect(find.text(_footnote), findsOneWidget);
    expect(find.textContaining('AI ব্যবহার'), findsNothing);
  });

  testWidgets('Listen speaks the speechText with amounts in words (AC-10)', (
    t,
  ) async {
    await pumpApp(
      t,
      const SummaryScreen(),
      overrides: _over(FakeSummaryRepository()),
    );
    await _settle(t);
    await t.tap(find.text('শুনুন'));
    await _settle(t);
    final voice =
        appContainer(t).read(voiceServiceProvider) as FakeVoiceService;
    expect(voice.spoken, hasLength(1));
    expect(voice.spoken.single, contains('বিয়াল্লিশ হাজার পাঁচশো টাকা'));
    expect(voice.spoken.single, isNot(contains('৳')));
  });

  testWidgets('the tip sits in its own box; usedAi only changes the footnote', (
    t,
  ) async {
    await pumpApp(
      t,
      const SummaryScreen(),
      overrides: _over(
        FakeSummaryRepository(
          summary: FakeSummaryRepository.sample(usedAi: true),
        ),
      ),
    );
    await _settle(t);
    expect(find.byKey(const ValueKey('summary-tip')), findsOneWidget);
    expect(find.textContaining('AI ব্যবহার'), findsNothing);
    expect(find.text(_footnote), findsNothing);
    expect(find.textContaining('এআই', findRichText: true), findsOneWidget);
  });

  testWidgets('offline fallback summary renders', (t) async {
    await pumpApp(
      t,
      const SummaryScreen(),
      overrides: _over(
        FakeSummaryRepository(
          summary: localSummary(
            month: '2026-11',
            locale: const Locale('bn'),
            expensePaisa: 4250000,
            lastMonthExpensePaisa: 3930000,
            incomePaisa: 0,
            topCategory: 'বাজার',
            topCategoryPaisa: 1680000,
          ),
        ),
      ),
    );
    await _settle(t);
    expect(find.textContaining('৳ ৪২,৫০০', findRichText: true), findsOneWidget);
    expect(find.textContaining('৳ ৩,২০০', findRichText: true), findsOneWidget);
    expect(
      find.textContaining('৳ ৩,২০০ বেশি', findRichText: true),
      findsOneWidget,
    );
    expect(find.text('শুনুন'), findsOneWidget);
  });
}
