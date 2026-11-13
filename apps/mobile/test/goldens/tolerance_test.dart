import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter_test/flutter_test.dart';

import 'golden_config.dart';

/// A 100 x 100 white PNG with the first [black] pixels black.
Future<Uint8List> _png(int black) async {
  final rec = ui.PictureRecorder();
  final c = ui.Canvas(rec);
  c.drawRect(
    const ui.Rect.fromLTWH(0, 0, 100, 100),
    ui.Paint()..color = const ui.Color(0xFFFFFFFF),
  );
  for (var i = 0; i < black; i++) {
    c.drawRect(
      ui.Rect.fromLTWH((i % 100).toDouble(), (i ~/ 100).toDouble(), 1, 1),
      ui.Paint()..color = const ui.Color(0xFF000000),
    );
  }
  final img = await rec.endRecording().toImage(100, 100);
  final data = await img.toByteData(format: ui.ImageByteFormat.png);
  return data!.buffer.asUint8List();
}

void main() {
  late Directory dir;
  late ToleranceComparator cmp;

  setUp(() async {
    dir = await Directory.systemTemp.createTemp('tolerance');
    cmp = ToleranceComparator(dir.uri.resolve('x_test.dart'));
  });
  tearDown(() => dir.delete(recursive: true));

  Future<bool> run(WidgetTester t, int black) async {
    final r = await t.runAsync(() async {
      await File('${dir.path}/base.png').writeAsBytes(await _png(0));
      try {
        return await cmp.compare(await _png(black), Uri.parse('base.png'));
      } on Object {
        return false;
      }
    });
    return r!;
  }

  testWidgets('1.9% difference passes', (t) async {
    expect(await run(t, 190), isTrue);
  });

  testWidgets('2.1% difference fails', (t) async {
    expect(await run(t, 210), isFalse);
  });
}
