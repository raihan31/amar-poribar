import 'bangla_words.dart';

/// A budget as returned by `GET /budgets` (amounts in paisa).
class BudgetStatus {
  final String? categoryId; // null = the overall budget
  final String nameBn;
  final int limitPaisa;
  final int spentPaisa;
  final String level; // ok | warning | exceeded
  const BudgetStatus(
    this.categoryId,
    this.nameBn,
    this.limitPaisa,
    this.spentPaisa,
    this.level,
  );
}

const _rank = {'ok': 0, 'warning': 1, 'exceeded': 2};

class SpokenAlert {
  final String key;
  final String level;
  final String text;
  const SpokenAlert(this.key, this.level, this.text);
}

/// Which alerts to speak now. An alert is spoken when a budget reaches 80% or 100%, and not again until it
/// gets worse (FR-BUD-02), so people are not nagged on every entry. [lastSpoken] maps a budget key to the
/// level already announced this month.
List<SpokenAlert> alertsToSpeak(
  List<BudgetStatus> budgets,
  Map<String, String> lastSpoken,
) {
  final out = <SpokenAlert>[];
  for (final b in budgets) {
    final level = b.level;
    if (level == 'ok') continue;
    final key = b.categoryId ?? 'overall';
    if ((_rank[level] ?? 0) <= (_rank[lastSpoken[key]] ?? 0)) continue;
    final name = b.categoryId == null ? 'মোট' : b.nameBn;
    final spent = amountInWords(b.spentPaisa);
    final limit = amountInWords(b.limitPaisa);
    final text = level == 'exceeded'
        ? '$name বাজেট ছাড়িয়ে গেছে। বাজেট ছিল $limit, খরচ হয়েছে $spent।'
        : '$name বাজেটের প্রায় সবটাই খরচ হয়ে গেছে। বাজেট $limit, খরচ হয়েছে $spent।';
    out.add(SpokenAlert(key, level, text));
  }
  return out;
}
