import 'dart:ui' show Locale;

import 'summary_repository.dart';

/// In-memory summary for widget tests (the numbers of Summary.dc.html).
class FakeSummaryRepository implements SummaryRepository {
  FakeSummaryRepository({MonthlySummary? summary})
      : summary = summary ?? sample();

  MonthlySummary summary;
  int loads = 0;

  static MonthlySummary sample({bool usedAi = false}) => MonthlySummary(
        locale: 'bn',
        month: '2026-11',
        text: 'এ মাসে আপনারা মোট ৳ ৪২,৫০০ খরচ করেছেন। '
            'গত মাসের চেয়ে ৳ ৩,২০০ বেশি। '
            'সবচেয়ে বেশি গেছে বাজারে, ৳ ১৬,৮০০। '
            'একটা কথা: চাল-ডাল একসাথে বেশি কিনলে খরচ কিছুটা কমতে পারে।',
        speechText:
            'এ মাসে আপনারা মোট বিয়াল্লিশ হাজার পাঁচশো টাকা খরচ করেছেন। '
            'গত মাসের চেয়ে তিন হাজার দুইশো টাকা বেশি। '
            'সবচেয়ে বেশি গেছে বাজারে, ষোলো হাজার আটশো টাকা। '
            'একটা কথা: চাল-ডাল একসাথে বেশি কিনলে খরচ কিছুটা কমতে পারে।',
        usedAi: usedAi,
      );

  @override
  Future<MonthlySummary> load(String month, Locale locale) async {
    loads++;
    return summary;
  }
}
