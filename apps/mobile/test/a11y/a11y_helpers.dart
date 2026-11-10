import 'package:amar_poribar/core/theme/contrast.dart';
import 'package:amar_poribar/core/theme/tokens.dart';
import 'package:amar_poribar/ui/status_chip.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';

/// Labels allowed to contain no Bangla character (brand words).
const Set<String> kBrandWords = {
  'bKash',
  'Nagad',
  'Rocket',
  'Upay',
  'Amar Poribar',
  'Google',
};

final RegExp _bangla = RegExp('[ঀ-৿]');

/// Fails when any tappable node lacks a Bangla label, is smaller than
/// [minSize], or is flagged `identifier: 'primary'` and smaller than
/// [primaryMin] (FR-A11Y-01).
Future<void> expectAllTappablesLabelled(
  WidgetTester t, {
  Size minSize = const Size(48, 48),
  Size primaryMin = const Size(56, 56),
}) async {
  final root = t.getSemantics(find.byType(Scaffold).first);
  final problems = <String>[];

  void visit(SemanticsNode n, Matrix4 parent) {
    final m = parent.clone();
    if (n.transform != null) m.multiply(n.transform!);
    final data = n.getSemanticsData();
    if (data.flagsCollection.isHidden) return;
    if (data.hasAction(SemanticsAction.tap)) {
      final label = data.label.trim();
      final who = label.isEmpty ? '<unlabelled>' : '"$label"';
      if (label.isEmpty) {
        problems.add('tappable $who has no label');
      } else if (!_bangla.hasMatch(label) && !kBrandWords.contains(label)) {
        problems.add('tappable $who has no Bangla character');
      }
      final r = MatrixUtils.transformRect(m, n.rect);
      final w = r.width;
      final h = r.height;
      if (w < minSize.width - 0.01 || h < minSize.height - 0.01) {
        problems.add('tappable $who is $w x $h, below $minSize');
      }
      if (data.identifier == 'primary' &&
          (w < primaryMin.width - 0.01 || h < primaryMin.height - 0.01)) {
        problems.add('primary $who is $w x $h, below $primaryMin');
      }
    }
    n.visitChildren((c) {
      visit(c, m);
      return true;
    });
  }

  visit(root, Matrix4.identity());
  if (problems.isNotEmpty) {
    throw TestFailure('Accessibility problems:\n${problems.join('\n')}');
  }
}

/// Every status chip (default: [StatusChip]) must contain an [Icon] and
/// non-empty text (FR-A11Y-02).
Future<void> expectNoColourOnlyStatus(WidgetTester t, {Finder? chips}) async {
  final all = chips ?? find.byType(StatusChip);
  final problems = <String>[];
  final count = all.evaluate().length;
  for (var i = 0; i < count; i++) {
    final chip = all.at(i);
    final icon = find.descendant(of: chip, matching: find.byType(Icon));
    final texts = find.descendant(of: chip, matching: find.byType(Text));
    final hasText = texts
        .evaluate()
        .any((e) => ((e.widget as Text).data ?? '').trim().isNotEmpty);
    if (icon.evaluate().isEmpty) problems.add('status chip #$i has no Icon');
    if (!hasText) problems.add('status chip #$i has no text');
  }
  if (problems.isNotEmpty) {
    throw TestFailure('Colour-only status:\n${problems.join('\n')}');
  }
}

Color? _backgroundOf(Element e) {
  Color? found;
  e.visitAncestorElements((a) {
    final w = a.widget;
    Color? c;
    if (w is Material) {
      c = w.color;
    } else if (w is ColoredBox) {
      c = w.color;
    } else if (w is DecoratedBox && w.decoration is BoxDecoration) {
      c = (w.decoration as BoxDecoration).color;
    } else if (w is Scaffold) {
      c = w.backgroundColor;
    }
    if (c != null && c.a == 1) {
      found = c;
      return false;
    }
    return true;
  });
  return found;
}

/// Text colours against their nearest opaque background (falls back to
/// [AppTokens.bg]) must reach 4.5:1, or 3:1 for large text. The token pairs in
/// [AppTokens.textPairs] are checked by the same maths.
Future<void> expectContrast(WidgetTester t) async {
  final problems = <String>[];
  for (final e in find.byType(Text).evaluate()) {
    final w = e.widget as Text;
    final s = DefaultTextStyle.of(e).style.merge(w.style);
    final fg = s.color;
    if (fg == null) continue;
    final bg = _backgroundOf(e) ?? AppTokens.bg;
    final size = s.fontSize ?? 14;
    final bold = (s.fontWeight?.value ?? 400) >= 700;
    final large = size >= 24 || (size >= 18.66 && bold);
    final need = large ? 3.0 : 4.5;
    final ratio = contrast(fg, bg);
    if (ratio < need) {
      problems.add(
        '"${w.data ?? w.textSpan}" ${ratio.toStringAsFixed(2)}:1 < $need:1',
      );
    }
  }
  if (problems.isNotEmpty) {
    throw TestFailure('Low contrast:\n${problems.join('\n')}');
  }
}
