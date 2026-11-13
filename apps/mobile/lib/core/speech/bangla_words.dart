/// Spoken Bangla for amounts and draft read-back. Mirrors packages/shared/src/words.ts and speech.ts,
/// because the TypeScript packages cannot be imported into Flutter.
library;

// Bangla has a distinct word for every number from 0 to 99.
const List<String> _under100 = [
  'শূন্য',
  'এক',
  'দুই',
  'তিন',
  'চার',
  'পাঁচ',
  'ছয়',
  'সাত',
  'আট',
  'নয়',
  'দশ',
  'এগারো',
  'বারো',
  'তেরো',
  'চৌদ্দ',
  'পনেরো',
  'ষোলো',
  'সতেরো',
  'আঠারো',
  'উনিশ',
  'বিশ',
  'একুশ',
  'বাইশ',
  'তেইশ',
  'চব্বিশ',
  'পঁচিশ',
  'ছাব্বিশ',
  'সাতাশ',
  'আঠাশ',
  'ঊনত্রিশ',
  'ত্রিশ',
  'একত্রিশ',
  'বত্রিশ',
  'তেত্রিশ',
  'চৌত্রিশ',
  'পঁয়ত্রিশ',
  'ছত্রিশ',
  'সাঁইত্রিশ',
  'আটত্রিশ',
  'ঊনচল্লিশ',
  'চল্লিশ',
  'একচল্লিশ',
  'বিয়াল্লিশ',
  'তেতাল্লিশ',
  'চুয়াল্লিশ',
  'পঁয়তাল্লিশ',
  'ছেচল্লিশ',
  'সাতচল্লিশ',
  'আটচল্লিশ',
  'ঊনপঞ্চাশ',
  'পঞ্চাশ',
  'একান্ন',
  'বাহান্ন',
  'তিপ্পান্ন',
  'চুয়ান্ন',
  'পঞ্চান্ন',
  'ছাপ্পান্ন',
  'সাতান্ন',
  'আটান্ন',
  'ঊনষাট',
  'ষাট',
  'একষট্টি',
  'বাষট্টি',
  'তেষট্টি',
  'চৌষট্টি',
  'পঁয়ষট্টি',
  'ছেষট্টি',
  'সাতষট্টি',
  'আটষট্টি',
  'ঊনসত্তর',
  'সত্তর',
  'একাত্তর',
  'বাহাত্তর',
  'তিয়াত্তর',
  'চুয়াত্তর',
  'পঁচাত্তর',
  'ছিয়াত্তর',
  'সাতাত্তর',
  'আটাত্তর',
  'ঊনআশি',
  'আশি',
  'একাশি',
  'বিরাশি',
  'তিরাশি',
  'চুরাশি',
  'পঁচাশি',
  'ছিয়াশি',
  'সাতাশি',
  'আটাশি',
  'ঊননব্বই',
  'নব্বই',
  'একানব্বই',
  'বিরানব্বই',
  'তিরানব্বই',
  'চুরানব্বই',
  'পঁচানব্বই',
  'ছিয়ানব্বই',
  'সাতানব্বই',
  'আটানব্বই',
  'নিরানব্বই',
];

/// Spell a non-negative integer in Bangla words (South Asian system), e.g. 125000 -> "এক লাখ পঁচিশ হাজার".
String numberToBanglaWords(int n) {
  if (n < 0) throw RangeError('Expected a non-negative integer');
  if (n < 100) return _under100[n];

  final parts = <String>[];
  final crore = n ~/ 10000000;
  final lakh = (n % 10000000) ~/ 100000;
  final thousand = (n % 100000) ~/ 1000;
  final hundred = (n % 1000) ~/ 100;
  final rest = n % 100;

  if (crore > 0) parts.add('${numberToBanglaWords(crore)} কোটি');
  if (lakh > 0) parts.add('${_under100[lakh]} লাখ');
  if (thousand > 0) parts.add('${_under100[thousand]} হাজার');
  if (hundred > 0) parts.add('${_under100[hundred]}শো');
  if (rest > 0) parts.add(_under100[rest]);
  return parts.join(' ');
}

/// Spoken amount, e.g. 234050 paisa -> "দুই হাজার তিনশো চল্লিশ টাকা পঞ্চাশ পয়সা".
String amountInWords(int paisa) {
  final abs = paisa.abs();
  final taka = abs ~/ 100;
  final poisha = abs % 100;
  var out = '${numberToBanglaWords(taka)} টাকা';
  if (poisha > 0) out += ' ${numberToBanglaWords(poisha)} পয়সা';
  return out;
}

/// Sentence read aloud after an entry so the user can check it by ear (FR-VOICE-03).
String draftToSpeech({
  required String type,
  required int amountPaisa,
  String? categoryName,
}) {
  final amount = amountInWords(amountPaisa);
  final verb =
      type == 'income' ? 'আয়' : (type == 'transfer' ? 'স্থানান্তর' : 'খরচ');
  if (categoryName == null) {
    return '$amount $verb। কিসের জন্য? নিচের ছবিতে চাপ দিন।';
  }
  return '$categoryName খাতে $amount $verb। ঠিক আছে?';
}
