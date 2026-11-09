import 'package:flutter_test/flutter_test.dart';

import 'package:amar_poribar/core/speech/bangla_words.dart';

void main() {
  // Same cases as packages/shared/src/words.test.ts, so both implementations agree.
  const cases = <int, String>{
    0: 'শূন্য',
    15: 'পনেরো',
    99: 'নিরানব্বই',
    100: 'একশো',
    850: 'আটশো পঞ্চাশ',
    2340: 'দুই হাজার তিনশো চল্লিশ',
    10000: 'দশ হাজার',
    125000: 'এক লাখ পঁচিশ হাজার',
    10000000: 'এক কোটি',
    20503021: 'দুই কোটি পাঁচ লাখ তিন হাজার একুশ',
    1500000000: 'একশো পঞ্চাশ কোটি',
  };
  cases.forEach((n, words) {
    test('$n -> $words', () => expect(numberToBanglaWords(n), words));
  });

  test('amount includes paisa', () {
    expect(amountInWords(234050), 'দুই হাজার তিনশো চল্লিশ টাকা পঞ্চাশ পয়সা');
    expect(amountInWords(85000), 'আটশো পঞ্চাশ টাকা');
  });

  test('draft read-back matches the web wording', () {
    expect(
      draftToSpeech(type: 'expense', amountPaisa: 85000, categoryName: 'বাজার ও মুদি'),
      'বাজার ও মুদি খাতে আটশো পঞ্চাশ টাকা খরচ। ঠিক আছে?',
    );
    expect(
      draftToSpeech(type: 'expense', amountPaisa: 50000),
      'পাঁচশো টাকা খরচ। কিসের জন্য? নিচের ছবিতে চাপ দিন।',
    );
  });

  test('rejects negative numbers', () => expect(() => numberToBanglaWords(-1), throwsRangeError));
}
