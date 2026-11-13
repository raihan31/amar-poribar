import 'dart:ui';

/// A foreground/background pair that must meet WCAG AA (4.5:1) for text.
class TextPair {
  const TextPair(this.name, this.fg, this.bg);

  final String name;
  final Color fg;
  final Color bg;
}

/// Avatar background and initial colours.
class AvatarColors {
  const AvatarColors(this.bg, this.fg);

  final Color bg;
  final Color fg;
}

/// Light design tokens (SRS 5.1.1).
class AppTokens {
  const AppTokens._();

  static const Color white = Color(0xFFFFFFFF);
  static const Color bg = Color(0xFFFFF8EE);
  static const Color ink = Color(0xFF2A2118);
  static const Color muted = Color(0xFF5A4B3B);
  static const Color green = Color(0xFF1B5E20);
  static const Color deepGreen = Color(0xFF14451A);
  static const Color greenTint = Color(0xFFE6F2E3);
  static const Color amber = Color(0xFFF2A33A);
  static const Color amberTint = Color(0xFFFDEBCB);
  static const Color amberInk = Color(0xFF6B3F00);
  static const Color danger = Color(0xFFB3261E);
  static const Color dangerTint = Color(0xFFF8D7D3);
  static const Color dangerInk = Color(0xFF8A1C14);
  static const Color border = Color(0xFFE8DCC8);
  static const Color inputBorder = Color(0xFFE1D3BC);
  static const Color switchOff = Color(0xFFC9BBA3);
  static const Color callBg = Color(0xFF14110D);

  static const double touchMin = 48;
  static const double primaryMin = 56;
  static const double simplePrimaryMin = 72;
  static const double radiusCard = 24;
  static const double radiusPill = 999;

  static const List<AvatarColors> avatars = [
    AvatarColors(Color(0xFFF4C7B8), Color(0xFF7A2E14)),
    AvatarColors(Color(0xFFE3D2F2), Color(0xFF4A2670)),
    AvatarColors(Color(0xFFCDE8C8), Color(0xFF1B5E20)),
    AvatarColors(Color(0xFFBFD8F2), Color(0xFF173F6B)),
  ];

  static const List<TextPair> textPairs = [
    TextPair('ink/bg', ink, bg),
    TextPair('muted/bg', muted, bg),
    TextPair('white/green', white, green),
    TextPair('ink/amber', ink, amber),
    TextPair('amberInk/amberTint', amberInk, amberTint),
    TextPair('dangerInk/dangerTint', dangerInk, dangerTint),
    TextPair('deepGreen/greenTint', deepGreen, greenTint),
    TextPair('white/danger', white, danger),
  ];
}
