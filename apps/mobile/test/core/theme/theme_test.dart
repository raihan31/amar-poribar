import 'package:amar_poribar/core/theme/app_theme.dart';
import 'package:amar_poribar/core/theme/ui_scale.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

double _minHeight(ThemeData t) =>
    t.elevatedButtonTheme.style!.minimumSize!.resolve({})!.height;

void main() {
  test('simple scale gives primary buttons a 72 dp minimum height', () {
    expect(_minHeight(lightTheme(UiScale.simple)), 72);
  });

  test('normal scale gives 56 dp; dark theme is dark; Material 3', () {
    expect(_minHeight(lightTheme(UiScale.normal)), 56);
    expect(darkTheme(UiScale.normal).brightness, Brightness.dark);
    expect(lightTheme(UiScale.normal).useMaterial3, isTrue);
  });

  test('ui scale values', () {
    expect(UiScale.normal.textScale, 1.0);
    expect(UiScale.simple.textScale, 1.3);
    expect(UiScale.normal.primaryHeight, 56);
    expect(UiScale.simple.primaryHeight, 72);
  });
}
