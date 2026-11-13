// ignore_for_file: file_names
import 'package:amar_poribar/features/home/state/home_providers.dart';
import 'package:amar_poribar/features/summary/data/fake_summary_repository.dart';
import 'package:amar_poribar/features/summary/state/summary_providers.dart';
import 'package:amar_poribar/features/summary/ui/summary_screen.dart';

import 'golden_config.dart';

/// Board: Summary.dc.html. 12:00 UTC on 9 Nov 2026 is November in Dhaka.
void main() {
  goldenScreen(
    'B2_summary',
    const SummaryScreen(),
    overrides: [
      homeClockProvider.overrideWithValue(() => DateTime.utc(2026, 11, 9, 12)),
      summaryRepositoryProvider.overrideWithValue(FakeSummaryRepository()),
    ],
  );
}
