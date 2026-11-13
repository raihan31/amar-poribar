import 'package:amar_poribar/core/theme/contrast.dart';
import 'package:amar_poribar/core/theme/dark_tokens.dart';
import 'package:amar_poribar/core/theme/tokens.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('contrast of black on white is 21', () {
    expect(contrast(Colors.black, Colors.white), closeTo(21, 0.01));
  });

  group('light text pairs', () {
    for (final p in AppTokens.textPairs) {
      test(p.name, () {
        expect(contrast(p.fg, p.bg), greaterThanOrEqualTo(4.5));
      });
    }
  });

  group('dark text pairs', () {
    for (final p in DarkTokens.textPairs) {
      test(p.name, () {
        expect(contrast(p.fg, p.bg), greaterThanOrEqualTo(4.5));
      });
    }
  });

  test('avatar palette pairs meet 4.5', () {
    for (final a in AppTokens.avatars) {
      expect(contrast(a.fg, a.bg), greaterThanOrEqualTo(4.5));
    }
  });
}
