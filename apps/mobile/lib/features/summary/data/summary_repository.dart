import 'dart:convert';
import 'dart:ui' show Locale;

import '../../../core/money/money.dart';
import '../../../core/money/money_format.dart';
import '../../../core/speech/bangla_words.dart';
import '../../../data/api/ai_api.dart';
import '../../../data/database/local_store.dart';
import '../../../domain/models/api/report.dart';
import '../../transactions/data/transaction_repository.dart';
import '../../transactions/domain/txn_query.dart';

export '../../../domain/models/api/report.dart' show MonthlySummary;

/// The monthly summary (FR-AI-11): `text` for the screen, `speechText` with amounts in words.
abstract class SummaryRepository {
  Future<MonthlySummary> load(String month, Locale locale);
}

const _monthsBn = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

const _monthsEn = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/// "নভেম্বর" for `2026-11`.
String monthName(String month, Locale locale) {
  final m = int.parse(month.split('-')[1]);
  return (locale.languageCode == 'en' ? _monthsEn : _monthsBn)[m - 1];
}

/// Same sentence patterns as the server's template summary (`packages/ai/src/summary.ts`), built
/// from the totals on this phone. Used when the server cannot be reached.
MonthlySummary localSummary({
  required String month,
  required Locale locale,
  required int expensePaisa,
  required int lastMonthExpensePaisa,
  required int incomePaisa,
  String? topCategory,
  int topCategoryPaisa = 0,
}) {
  final en = locale.languageCode == 'en';
  final name = monthName(month, locale);
  String digits(int p) => formatMoney(
        Money(p),
        style: en ? NumeralStyle.latin : NumeralStyle.bangla,
      );
  String words(int p) => en ? digits(p) : amountInWords(p);

  String build(String Function(int) fmt) {
    final change = (expensePaisa - lastMonthExpensePaisa).abs();
    final up = expensePaisa >= lastMonthExpensePaisa;
    final parts = <String>[];
    if (en) {
      parts.add(
        expensePaisa == 0
            ? 'No expenses recorded for $name yet.'
            : 'In $name the family spent ${fmt(expensePaisa)}.',
      );
      if (expensePaisa > 0 && lastMonthExpensePaisa > 0) {
        parts.add(
          'That is ${fmt(change)} ${up ? 'more' : 'less'} than last month.',
        );
      }
      if (topCategory != null) {
        parts.add('The most went on $topCategory: ${fmt(topCategoryPaisa)}.');
      }
      if (incomePaisa > 0) parts.add('Income this month: ${fmt(incomePaisa)}.');
    } else {
      parts.add(
        expensePaisa == 0
            ? '$name মাসে এখনো কোনো খরচ লেখা হয়নি।'
            : '$name মাসে পরিবারের মোট খরচ ${fmt(expensePaisa)}।',
      );
      if (expensePaisa > 0 && lastMonthExpensePaisa > 0) {
        parts.add('গত মাসের চেয়ে ${fmt(change)} ${up ? 'বেশি' : 'কম'}।');
      }
      if (topCategory != null) {
        parts.add(
          'সবচেয়ে বেশি খরচ $topCategory খাতে, ${fmt(topCategoryPaisa)}।',
        );
      }
      if (incomePaisa > 0) parts.add('এই মাসে আয় ${fmt(incomePaisa)}।');
    }
    return parts.join(' ');
  }

  return MonthlySummary(
    locale: locale.languageCode,
    month: month,
    text: build(digits),
    speechText: build(words),
    usedAi: false,
  );
}

String _previous(String month) {
  final p = month.split('-');
  final y = int.parse(p[0]);
  final m = int.parse(p[1]);
  return m == 1
      ? '${y - 1}-12'
      : '${p[0]}-${(m - 1).toString().padLeft(2, '0')}';
}

/// `GET /ai/summary`, cached per month in `Meta('summary:<month>')`; offline it serves the cached
/// copy, or a template built from local totals.
class ApiSummaryRepository implements SummaryRepository {
  ApiSummaryRepository(
    this._api,
    this._store,
    this._txns, {
    required this.familyId,
    this.viewerUserId,
  });

  final AiApi _api;
  final LocalStore _store;
  final TransactionRepository _txns;
  final String? Function() familyId;
  final String? Function()? viewerUserId;

  static String cacheKey(String month) => 'summary:$month';

  @override
  Future<MonthlySummary> load(String month, Locale locale) async {
    final family = familyId();
    if (family != null) {
      try {
        final s = await _api.summary(
          family,
          locale: locale.languageCode,
          month: month,
        );
        await _store.setMeta(cacheKey(month), jsonEncode(s.toJson()));
        return s;
      } catch (_) {
        final cached = await _cached(month, locale);
        if (cached != null) return cached;
      }
    }
    return _fromLocal(family, month, locale);
  }

  Future<MonthlySummary?> _cached(String month, Locale locale) async {
    try {
      final raw = await _store.getMeta(cacheKey(month));
      if (raw == null) return null;
      final s = MonthlySummary.fromJson(
        (jsonDecode(raw) as Map).cast<String, dynamic>(),
      );
      return s.locale == locale.languageCode ? s : null;
    } catch (_) {
      return null;
    }
  }

  int _sum(Iterable<dynamic> rows) {
    var total = 0;
    for (final t in rows) {
      total += (t.amountPaisa as int) + (t.feePaisa as int);
    }
    return total;
  }

  Future<MonthlySummary> _fromLocal(
    String? family,
    String month,
    Locale locale,
  ) async {
    if (family == null) {
      return localSummary(
        month: month,
        locale: locale,
        expensePaisa: 0,
        lastMonthExpensePaisa: 0,
        incomePaisa: 0,
      );
    }
    final viewer = viewerUserId?.call();
    TxnQuery q(String m, String type) =>
        TxnQuery(familyId: family, month: m, type: type, viewerUserId: viewer);
    final expenses = await _txns.watch(q(month, 'expense')).first;
    final last = await _txns.watch(q(_previous(month), 'expense')).first;
    final income = await _txns.watch(q(month, 'income')).first;

    final byCategory = <String, int>{};
    for (final t in expenses) {
      final c = t.categoryId;
      if (c != null) {
        byCategory[c] = (byCategory[c] ?? 0) + t.amountPaisa + t.feePaisa;
      }
    }
    String? topName;
    var topPaisa = 0;
    if (byCategory.isNotEmpty) {
      final top = byCategory.entries.reduce(
        (a, b) => b.value > a.value ? b : a,
      );
      final cats = await _store.categories();
      for (final c in cats) {
        if (c.id == top.key) {
          topName = locale.languageCode == 'en' ? c.nameEn : c.nameBn;
        }
      }
      topPaisa = top.value;
    }
    return localSummary(
      month: month,
      locale: locale,
      expensePaisa: _sum(expenses),
      lastMonthExpensePaisa: _sum(last),
      incomePaisa: _sum(income),
      topCategory: topName,
      topCategoryPaisa: topPaisa,
    );
  }
}
