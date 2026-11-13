/// Offline quick parser (SRS 6.1, FR-AI-13): one amount plus at most one known keyword, no network.
/// Anything it is not sure about returns null and falls through to the AI.
library;

import '../../../core/speech/bangla_words.dart';
import '../../../core/speech/categories.dart';
import '../../../domain/models/api/draft.dart';

/// What the quick parser understood from one sentence.
class QuickParseResult {
  const QuickParseResult({
    required this.type,
    required this.amountPaisa,
    required this.categoryKey,
    required this.accountType,
    required this.occurredAt,
    required this.confidence,
  });

  /// `expense` or `income`.
  final String type;
  final int amountPaisa;

  /// Null when no known keyword was said: the screen then asks with the picture picker.
  final String? categoryKey;
  final String accountType;
  final DateTime occurredAt;
  final double confidence;

  TransactionDraft toDraft({required String source, String note = ''}) =>
      TransactionDraft(
        type: type,
        amountPaisa: amountPaisa,
        feePaisa: 0,
        occurredAt: occurredAt.toUtc().toIso8601String(),
        categoryKey: categoryKey,
        accountType: accountType,
        note: note,
        counterparty: null,
        trxId: null,
        source: source,
        confidence: confidence,
      );
}

const _bnDigits = '০১২৩৪৫৬৭৮৯';
const _multipliers = {
  'হাজার': 1000,
  'লাখ': 100000,
  'লক্ষ': 100000,
  'কোটি': 10000000,
};
const _currency = {'৳', 'tk', 'taka'};
const _incomeWords = ['পেলাম', 'পাইলাম', 'পেয়েছি', 'আয়'];

/// Largest amount accepted, 1 crore taka in paisa (FR-TXN-09).
const _maxPaisa = 10000000 * 100;

/// Parses [text] spoken or typed in Bangla. [nowDhaka] is the moment of speaking; "আজ" keeps it
/// and "গতকাল" goes back one day. Returns null for no amount, more than one amount, or two
/// different categories.
QuickParseResult? quickParse(String text, DateTime nowDhaka) {
  final tokens = _tokenize(text);
  final runs = <(int, int)>[]; // [start, end) of consecutive number tokens
  var i = 0;
  while (i < tokens.length) {
    if (_isNumberToken(tokens[i])) {
      var j = i;
      while (j < tokens.length && _isNumberToken(tokens[j])) {
        j++;
      }
      runs.add((i, j));
      i = j;
    } else {
      i++;
    }
  }
  if (runs.length != 1) return null;
  final (start, end) = runs.single;

  // "দুই কেজি চাল" is not money: a taka marker must touch the number.
  final marked = (start > 0 && _isCurrency(tokens[start - 1])) ||
      (end < tokens.length && _isCurrency(tokens[end]));
  if (!marked) return null;

  final total2 = _evaluate(tokens.sublist(start, end));
  if (total2 == null || total2 <= 0) return null;
  final paisa = total2 * 50; // total2 counts half taka
  if (paisa > _maxPaisa) return null;

  final keys = _matchCategories(tokens);
  if (keys.length > 1) return null;
  final key = keys.isEmpty ? null : keys.single;

  final incomeKey = key != null && categoryByKey(key)?.kind == 'income';
  final isIncome = incomeKey || tokens.any(_incomeWords.contains);

  var daysAgo = 0;
  for (var k = 0; k < tokens.length; k++) {
    if (tokens[k].startsWith('গতকাল') ||
        (tokens[k] == 'গত' &&
            k + 1 < tokens.length &&
            tokens[k + 1].startsWith('কাল'))) {
      daysAgo = 1;
    }
  }

  return QuickParseResult(
    type: isIncome ? 'income' : 'expense',
    amountPaisa: paisa,
    categoryKey: key,
    accountType: _account(tokens),
    occurredAt: nowDhaka.subtract(Duration(days: daysAgo)),
    confidence: key == null ? 0.5 : 0.8,
  );
}

List<String> _tokenize(String text) {
  var s = text.replaceAll('৳', ' ৳ ').toLowerCase();
  // Keep the comma inside "1,200", drop it elsewhere.
  s = s.replaceAllMapped(
    RegExp('[$_bnDigits]'),
    (m) => '${_bnDigits.indexOf(m[0]!)}',
  );
  s = s.replaceAllMapped(RegExp(r'(\d),(?=\d)'), (m) => m[1]!);
  s = s.replaceAll(RegExp(r'[,।.!?"“”‘’()]'), ' ');
  return s.split(RegExp(r'\s+')).where((t) => t.isNotEmpty).toList();
}

bool _isCurrency(String t) => _currency.contains(t) || t.startsWith('টাকা');

int? _wordOrDigits(String t) =>
    RegExp(r'^\d+$').hasMatch(t) ? int.parse(t) : banglaWordValue(t);

/// Doubled value of the part before "শো", so halves stay whole numbers.
int? _hundredsBase2(String t) {
  if (t == 'দেড়') return 3;
  if (t == 'আড়াই') return 5;
  final v = _wordOrDigits(t);
  return v == null ? null : v * 2;
}

bool _isNumberToken(String t) {
  if (_wordOrDigits(t) != null) return true;
  if (_multipliers.containsKey(t) ||
      t == 'শো' ||
      t == 'শ' ||
      t == 'দেড়' ||
      t == 'আড়াই' ||
      t == 'সাড়ে') {
    return true;
  }
  return _splitHundred(t) != null;
}

/// "আটশো" -> 8 (as doubled value 16) when the word is a number plus শো.
int? _splitHundred(String t) {
  for (final suffix in ['শো', 'শ']) {
    if (t.length > suffix.length && t.endsWith(suffix)) {
      return _hundredsBase2(t.substring(0, t.length - suffix.length));
    }
  }
  return null;
}

/// Total in half taka, or null if the words do not make a number.
int? _evaluate(List<String> run) {
  var total2 = 0;
  var cur2 = 0;
  var half = false;
  for (final t in run) {
    final plain = _wordOrDigits(t);
    final hundred = _splitHundred(t);
    if (plain != null) {
      cur2 += plain * 2 + (half ? 1 : 0);
      half = false;
    } else if (hundred != null) {
      cur2 += (hundred + (half ? 1 : 0)) * 100;
      half = false;
    } else if (t == 'শো' || t == 'শ') {
      cur2 = (cur2 == 0 ? 2 : cur2) * 100;
    } else if (_multipliers.containsKey(t)) {
      total2 += (cur2 == 0 ? 2 : cur2) * _multipliers[t]!;
      cur2 = 0;
    } else if (t == 'দেড়') {
      cur2 += 3;
    } else if (t == 'আড়াই') {
      cur2 += 5;
    } else if (t == 'সাড়ে') {
      half = true;
    } else {
      return null;
    }
  }
  return total2 + cur2;
}

Set<String> _matchCategories(List<String> tokens) {
  final found = <String>{};
  kCategoryKeywords.forEach((key, words) {
    for (final phrase in words) {
      final parts = phrase.split(' ');
      for (var i = 0; i + parts.length <= tokens.length; i++) {
        var all = true;
        for (var p = 0; p < parts.length; p++) {
          if (!tokens[i + p].startsWith(parts[p])) {
            all = false;
            break;
          }
        }
        if (all) found.add(key);
      }
    }
  });
  return found;
}

String _account(List<String> tokens) {
  for (final t in tokens) {
    if (t.startsWith('ক্যাশ')) return 'cash';
    if (t.startsWith('বিকাশ')) return 'bkash';
    if (t.startsWith('রকেট')) return 'rocket';
    if (t.startsWith('ব্যাংক')) return 'bank';
  }
  return 'cash';
}
