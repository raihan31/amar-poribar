import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'money_format.dart';

/// The user's numeral setting (Bangla digits by default).
final numeralStyleProvider =
    StateProvider<NumeralStyle>((ref) => NumeralStyle.bangla);
