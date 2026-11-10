import 'dart:async';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Loads Hind Siliguri before every test file.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  TestWidgetsFlutterBinding.ensureInitialized();
  final loader = FontLoader('HindSiliguri');
  for (final w in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
    final bytes = File('assets/fonts/HindSiliguri-$w.ttf').readAsBytesSync();
    loader.addFont(Future.value(ByteData.view(bytes.buffer)));
  }
  await loader.load();
  await testMain();
}
