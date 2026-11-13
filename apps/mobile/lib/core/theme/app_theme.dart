import 'package:flutter/material.dart';

import 'dark_tokens.dart';
import 'tokens.dart';
import 'ui_scale.dart';

const String _font = 'HindSiliguri';

ThemeData lightTheme(UiScale scale) => _build(
      scale,
      const ColorScheme(
        brightness: Brightness.light,
        primary: AppTokens.green,
        onPrimary: AppTokens.white,
        primaryContainer: AppTokens.greenTint,
        onPrimaryContainer: AppTokens.deepGreen,
        secondary: AppTokens.amber,
        onSecondary: AppTokens.ink,
        secondaryContainer: AppTokens.amberTint,
        onSecondaryContainer: AppTokens.amberInk,
        error: AppTokens.danger,
        onError: AppTokens.white,
        errorContainer: AppTokens.dangerTint,
        onErrorContainer: AppTokens.dangerInk,
        surface: AppTokens.bg,
        onSurface: AppTokens.ink,
        onSurfaceVariant: AppTokens.muted,
        outline: AppTokens.inputBorder,
        outlineVariant: AppTokens.border,
      ),
      inputBorder: AppTokens.inputBorder,
      cardBorder: AppTokens.border,
      cardColor: AppTokens.white,
    );

ThemeData darkTheme(UiScale scale) => _build(
      scale,
      const ColorScheme(
        brightness: Brightness.dark,
        primary: DarkTokens.green,
        onPrimary: DarkTokens.bg,
        primaryContainer: DarkTokens.greenTint,
        onPrimaryContainer: DarkTokens.green,
        secondary: DarkTokens.amber,
        onSecondary: DarkTokens.bg,
        error: DarkTokens.danger,
        onError: DarkTokens.bg,
        surface: DarkTokens.bg,
        onSurface: DarkTokens.ink,
        onSurfaceVariant: DarkTokens.muted,
        surfaceContainerHighest: DarkTokens.surface,
        outline: DarkTokens.border,
        outlineVariant: DarkTokens.border,
      ),
      inputBorder: DarkTokens.border,
      cardBorder: DarkTokens.border,
      cardColor: DarkTokens.surface,
    );

ThemeData _build(
  UiScale scale,
  ColorScheme scheme, {
  required Color inputBorder,
  required Color cardBorder,
  required Color cardColor,
}) {
  OutlineInputBorder outline(Color c, double w) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: c, width: w),
      );
  // Selected navigation items use the brand green (primary).
  final selected = scheme.primary;

  return ThemeData(
    useMaterial3: true,
    fontFamily: _font,
    colorScheme: scheme,
    scaffoldBackgroundColor: scheme.surface,
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        minimumSize: Size(0, scale.primaryHeight),
        shape: const StadiumBorder(),
        textStyle: const TextStyle(
          fontFamily: _font,
          fontSize: 18,
          fontWeight: FontWeight.w700,
        ),
        backgroundColor: scheme.primary,
        foregroundColor: scheme.onPrimary,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        minimumSize: const Size(0, AppTokens.touchMin),
        foregroundColor: scheme.primary,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      border: outline(inputBorder, 1.5),
      enabledBorder: outline(inputBorder, 1.5),
      focusedBorder: outline(scheme.primary, 3),
    ),
    cardTheme: CardThemeData(
      color: cardColor,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppTokens.radiusCard),
        side: BorderSide(color: cardBorder),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: 72,
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      iconTheme: WidgetStateProperty.resolveWith(
        (s) => IconThemeData(
          color: s.contains(WidgetState.selected)
              ? selected
              : scheme.onSurfaceVariant,
        ),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (s) => TextStyle(
          fontFamily: _font,
          fontWeight: FontWeight.w600,
          color: s.contains(WidgetState.selected)
              ? selected
              : scheme.onSurfaceVariant,
        ),
      ),
    ),
  );
}
