/// Golden test infrastructure (T-MOB-52, NFR-24).
///
/// Every screen task adds a golden with one call:
/// ```dart
/// goldenScreen('A1_login', const LoginScreen(), overrides: [...]);
/// goldenScreen('A1_login', const LoginScreen(), dark: true); // A1_login_dark.png
/// ```
/// Files land in `goldens/ci/<name>.png` next to the test file. See README.md.
library;

import 'dart:typed_data';

import 'package:alchemist/alchemist.dart';
import 'package:amar_poribar/core/theme/app_theme.dart';
import 'package:amar_poribar/core/theme/ui_scale.dart';
import 'package:amar_poribar/data/database/database.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:amar_poribar/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_voice_service.dart';
import '../helpers/fakes.dart';

/// The design boards are 390 x 844.
const Size kGoldenSize = Size(390, 844);

/// Largest share of differing pixels that still passes (SRS NFR-24: 2%).
const double kGoldenTolerance = 0.02;

/// A [LocalFileComparator] that passes when at most [tolerance] of the pixels differ.
class ToleranceComparator extends LocalFileComparator {
  ToleranceComparator(super.testFile, {this.tolerance = kGoldenTolerance});

  /// Builds a comparator for the test file that is running now.
  factory ToleranceComparator.current([double tolerance = kGoldenTolerance]) {
    final current = goldenFileComparator;
    final base = current is LocalFileComparator
        ? current.basedir
        : Uri.directory('${Uri.base.toFilePath()}test/goldens/');
    return ToleranceComparator(
      base.resolve('_golden_test.dart'),
      tolerance: tolerance,
    );
  }

  final double tolerance;

  @override
  Future<bool> compare(Uint8List imageBytes, Uri golden) async {
    final result = await GoldenFileComparator.compareLists(
      imageBytes,
      await getGoldenBytes(golden),
    );
    if (result.passed || result.diffPercent <= tolerance) {
      result.dispose();
      return true;
    }
    final error = await generateFailureOutput(result, golden, basedir);
    result.dispose();
    throw FlutterError(error);
  }
}

/// Renders [screen] at [kGoldenSize] in the real theme, Bangla locale and fake providers, and
/// compares it with `goldens/ci/<name>.png` (`<name>_dark.png` when [dark]).
void goldenScreen(
  String name,
  Widget screen, {
  List<Override> overrides = const [],
  bool dark = false,
  UiScale scale = UiScale.normal,
}) {
  final fileName = dark ? '${name}_dark' : name;
  late LocalStore store;
  AlchemistConfig.runWithConfig(
    config: const AlchemistConfig(
      platformGoldensConfig: PlatformGoldensConfig(enabled: false),
      ciGoldensConfig: CiGoldensConfig(enabled: true),
    ),
    run: () {
      goldenTest(
        fileName,
        fileName: fileName,
        constraints: BoxConstraints.tight(kGoldenSize),
        pumpWidget: (tester, widget) async {
          goldenFileComparator = ToleranceComparator.current();
          store = (await tester.runAsync(
            () => LocalStore.open(AppDatabase.memory()),
          ))!;
          addTearDown(() => tester.runAsync(store.db.close));
          await tester.pumpWidget(widget);
        },
        builder: () => GoldenTestGroup(
          columns: 1,
          scenarioConstraints: BoxConstraints.tight(kGoldenSize),
          children: [
            GoldenTestScenario.builder(
              name: fileName,
              constraints: BoxConstraints.tight(kGoldenSize),
              builder: (_) => ProviderScope(
                overrides: [
                  ...defaultFakes(store: store, voice: FakeVoiceService()),
                  ...overrides,
                ],
                child: MaterialApp(
                  debugShowCheckedModeBanner: false,
                  localizationsDelegates:
                      AppLocalizations.localizationsDelegates,
                  supportedLocales: AppLocalizations.supportedLocales,
                  locale: const Locale('bn'),
                  theme: lightTheme(scale),
                  darkTheme: darkTheme(scale),
                  themeMode: dark ? ThemeMode.dark : ThemeMode.light,
                  home: screen,
                ),
              ),
            ),
          ],
        ),
      );
    },
  );
}
