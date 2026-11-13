import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../ui/bottom_tabs.dart';

/// Unread chat messages across all conversations. Zero until T-MOB-37 provides the real count.
final totalUnreadProvider = Provider<int>((ref) => 0);

/// The five-tab frame around the shell branches.
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: AppBottomTabs(
        index: navigationShell.currentIndex,
        chatBadge: ref.watch(totalUnreadProvider),
        onSelect: (i) => navigationShell.goBranch(
          i,
          initialLocation: i == navigationShell.currentIndex,
        ),
      ),
    );
  }
}
