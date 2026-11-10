import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Bangla text renders with HindSiliguri and non-zero width',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Text(
          'আমার পরিবার',
          style: TextStyle(fontFamily: 'HindSiliguri', fontSize: 20),
        ),
      ),
    );
    final finder = find.text('আমার পরিবার');
    expect(tester.getSize(finder).width, greaterThan(0));
    final text = tester.widget<Text>(finder);
    expect(text.style?.fontFamily, 'HindSiliguri');
  });
}
