import 'dart:ui';

import 'tokens.dart';

/// Dark counterparts of [AppTokens].
class DarkTokens {
  const DarkTokens._();

  static const Color bg = Color(0xFF1A1510);
  static const Color surface = Color(0xFF241E17);
  static const Color ink = Color(0xFFF5EDE0);
  static const Color muted = Color(0xFFCDBFA8);
  static const Color green = Color(0xFF7DD184);
  static const Color greenTint = Color(0xFF1F3A22);
  static const Color amber = Color(0xFFF2A33A);
  static const Color danger = Color(0xFFF2B8B5);
  static const Color border = Color(0xFF3A3126);

  static const List<TextPair> textPairs = [
    TextPair('ink/bg', ink, bg),
    TextPair('ink/surface', ink, surface),
    TextPair('muted/bg', muted, bg),
    TextPair('muted/surface', muted, surface),
    TextPair('green/bg', green, bg),
    TextPair('green/surface', green, surface),
    TextPair('green/greenTint', green, greenTint),
    TextPair('amber/bg', amber, bg),
    TextPair('danger/bg', danger, bg),
    TextPair('danger/surface', danger, surface),
    TextPair('bg/green', bg, green),
    TextPair('bg/amber', bg, amber),
  ];
}
