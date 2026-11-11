import 'package:flutter/material.dart';

import '../../../app/redirects.dart';
import '../../../app/screens.dart';

/// Simple mode home (T-MOB-50 builds the real one). Shown at `/home` while the sizing is Simple.
class SimpleHomeScreen extends StatelessWidget {
  const SimpleHomeScreen({super.key});

  @override
  Widget build(BuildContext context) => const PlaceholderScreen(Routes.simple);
}
