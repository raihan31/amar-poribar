import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/models/enums.dart';
import '../providers/providers.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(appStateProvider);
    
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          ListTile(
            leading: const Icon(Icons.person),
            title: const Text('Current Role'),
            subtitle: Text(state.activeRole.name.toUpperCase()),
            trailing: const Icon(Icons.chevron_right),
          ),
          const Divider(),
          if (state.activeRole == Role.father || state.activeRole == Role.mother) ...[
            const ListTile(
              leading: Icon(Icons.qr_code),
              title: Text('Pair New Device'),
              subtitle: Text('Generate a QR Code to add Child or partner'),
            ),
            const Divider(),
          ],
          const ListTile(
            leading: Icon(Icons.sync),
            title: Text('Force Sync'),
            subtitle: Text('Last synced: 2 mins ago'),
            trailing: Icon(Icons.settings_bluetooth),
          ),
        ],
      ),
    );
  }
}

class PendingSmsScreen extends StatelessWidget {
  const PendingSmsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Bank Approvals')),
      body: const Center(
        child: Text('No pending bank transactions detected today.'),
      ),
    );
  }
}
