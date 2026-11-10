import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import '../../tool/l10n_check.dart';

void main() {
  test('the real catalogues have zero differences', () {
    expect(checkL10n(arbDir: 'lib/l10n', libDir: 'lib'), isEmpty);
  });

  group('checker logic', () {
    late Directory tmp;
    late Directory arb;
    late Directory lib;

    setUp(() {
      tmp = Directory.systemTemp.createTempSync('l10n_check');
      arb = Directory('${tmp.path}/arb')..createSync();
      lib = Directory('${tmp.path}/lib')..createSync();
    });
    tearDown(() => tmp.deleteSync(recursive: true));

    void put(String name, String json) =>
        File('${arb.path}/$name').writeAsStringSync(json);
    void code(String src) => File('${lib.path}/a.dart').writeAsStringSync(src);
    List<String> run() => checkL10n(arbDir: arb.path, libDir: lib.path);

    test('passes when both files match and every key is used', () {
      put('app_bn.arb', '{"a_b": "হ্যাঁ {n}", "@a_b": {}}');
      put('app_en.arb', '{"a_b": "Yes {n}"}');
      code('final x = context.l10n.a_b;');
      expect(run(), isEmpty);
    });

    test('reports a key present in only one language', () {
      put('app_bn.arb', '{"a_b": "হ্যাঁ", "a_c": "না"}');
      put('app_en.arb', '{"a_b": "Yes"}');
      code('l10n.a_b; l10n.a_c;');
      expect(run().join('\n'), contains('a_c'));
      expect(run().join('\n'), contains('missing in app_en.arb'));
    });

    test('reports an unused key', () {
      put('app_bn.arb', '{"a_b": "হ্যাঁ", "a_c": "না"}');
      put('app_en.arb', '{"a_b": "Yes", "a_c": "No"}');
      code('l10n.a_b;');
      expect(run().join('\n'), contains('unused key a_c'));
    });

    test('reports English letters in a bn value, allowing brands', () {
      put('app_bn.arb', '{"a_b": "Hello", "a_c": "বিকাশ bKash OTP {code}"}');
      put('app_en.arb', '{"a_b": "Hello", "a_c": "bKash"}');
      code('l10n.a_b; l10n.a_c;');
      final out = run();
      expect(out, hasLength(1));
      expect(out.single, contains('a_b'));
    });

    test('ignores ICU plural keywords and placeholders', () {
      put(
        'app_bn.arb',
        '{"a_b": "{count, plural, =0{নেই} other{{count}টি}}"}',
      );
      put('app_en.arb', '{"a_b": "{count, plural, =0{none} other{{count}}}"}');
      code('l10n.a_b;');
      expect(run(), isEmpty);
    });
  });
}
