import 'package:amar_poribar/core/speech/budget_alerts.dart';
import 'package:amar_poribar/core/speech/tutorial.dart';
import 'package:flutter_test/flutter_test.dart';

BudgetStatus b(String? id, String name, int limit, int spent, String level) =>
    BudgetStatus(id, name, limit, spent, level);

void main() {
  test('speaks nothing while budgets are fine', () {
    expect(alertsToSpeak([b('c1', 'বাজার', 100000, 50000, 'ok')], {}), isEmpty);
  });

  test('warns near the limit, in words', () {
    final a =
        alertsToSpeak([b('c1', 'বাজার ও মুদি', 100000, 90000, 'warning')], {});
    expect(a, hasLength(1));
    expect(a.single.level, 'warning');
    expect(a.single.text, contains('বাজার ও মুদি'));
    expect(
      a.single.text,
      contains('একহাজার টাকা'.replaceAll('একহাজার', 'এক হাজার')),
    );
    expect(a.single.text, contains('নয়শো টাকা'));
  });

  test('says "over budget" when exceeded, and calls the overall budget "মোট"',
      () {
    final a =
        alertsToSpeak([b(null, 'Overall', 500000, 600000, 'exceeded')], {});
    expect(a.single.key, 'overall');
    expect(a.single.text, startsWith('মোট বাজেট ছাড়িয়ে গেছে'));
  });

  test('does not repeat the same alert, but does speak when it gets worse', () {
    final warn = [b('c1', 'বাজার', 100000, 90000, 'warning')];
    expect(alertsToSpeak(warn, {'c1': 'warning'}), isEmpty);
    expect(
      alertsToSpeak(warn, {'c1': 'exceeded'}),
      isEmpty,
      reason: 'never step back down',
    );
    final over = [b('c1', 'বাজার', 100000, 120000, 'exceeded')];
    expect(alertsToSpeak(over, {'c1': 'warning'}), hasLength(1));
  });

  test('each budget is tracked separately', () {
    final both = [
      b('c1', 'বাজার', 100, 90, 'warning'),
      b('c2', 'ভাড়া', 100, 95, 'warning'),
    ];
    final a = alertsToSpeak(both, {'c1': 'warning'});
    expect(a.map((x) => x.key), ['c2']);
  });

  test('the tutorial has short, spoken-friendly steps', () {
    expect(kTutorialSteps.length, inInclusiveRange(4, 8));
    for (final s in kTutorialSteps) {
      expect(s.length, lessThan(160), reason: 'short enough to listen to');
      expect(
        RegExp(r'[0-9]').hasMatch(s),
        isFalse,
        reason: 'digits are read badly by TTS; use words',
      );
    }
  });
}
