import 'package:amar_poribar/ui/bottom_tabs.dart';
import 'package:flutter/material.dart';

import 'golden_config.dart';

void main() {
  goldenScreen(
    'Main_tabs',
    Scaffold(
      body: const SizedBox.expand(),
      bottomNavigationBar: AppBottomTabs(
        index: 0,
        onSelect: (_) {},
        chatBadge: 2,
      ),
    ),
  );
  goldenScreen(
    'Main_tabs',
    Scaffold(
      body: const SizedBox.expand(),
      bottomNavigationBar: AppBottomTabs(index: 2, onSelect: (_) {}),
    ),
    dark: true,
  );
}
