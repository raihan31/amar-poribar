import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/sync/nearby_transport.dart';
import '../../data/sync/p2p_transport.dart';
import '../../data/sync/peer_sync_engine.dart';
import '../../domain/models/enums.dart';
import '../providers/auth_provider.dart';
import '../providers/providers.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  PeerSyncEngine? _engine;
  String _status = '';

  @override
  void dispose() {
    _engine?.stop();
    super.dispose();
  }

  /// Both phones show the same short code; connect only if the people holding them agree it matches.
  Future<bool> _approve(PeerInfo peer) async {
    if (!mounted) return false;
    final ok = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('কাছের ফোনের সাথে সিঙ্ক?'),
        content: Text(
            'ফোন: ${peer.name}\nকোড: ${peer.authCode}\n\nদুই ফোনেই একই কোড দেখালে "হ্যাঁ" চাপুন।'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('না')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('হ্যাঁ')),
        ],
      ),
    );
    return ok ?? false;
  }

  Future<void> _toggleNearby() async {
    if (_engine != null) {
      await _engine!.stop();
      setState(() {
        _engine = null;
        _status = '';
      });
      return;
    }
    final family = ref.read(authProvider).family;
    if (family == null) {
      setState(() =>
          _status = 'প্রথমে একবার লগইন করে পরিবারে যোগ দিন (ইন্টারনেট লাগবে)।');
      return;
    }
    final engine = PeerSyncEngine(
      store: ref.read(localStoreProvider),
      transport: NearbyTransport(),
      familyId: family.id,
      approve: _approve,
      onStatus: (m) {
        if (!mounted) return;
        setState(() => _status = m);
        ref.read(appStateProvider.notifier).reload();
      },
    );
    try {
      await engine.start();
      setState(() => _engine = engine);
    } catch (e) {
      setState(() => _status =
          'কাছের সিঙ্ক চালু করা যায়নি: অনুমতি দিন (ব্লুটুথ, লোকেশন)।');
    }
  }

  Future<void> _syncServer() async {
    final family = ref.read(authProvider).family;
    if (family == null) {
      setState(() => _status = 'সিঙ্ক করতে লগইন করুন।');
      return;
    }
    try {
      final sync = ref.read(syncServiceProvider);
      await sync.refreshReferenceData(family.id);
      final r = await sync.sync(family.id);
      await ref.read(appStateProvider.notifier).reload();
      setState(() => _status =
          'সার্ভারের সাথে সিঙ্ক হয়েছে: ${r.pushed} পাঠানো, ${r.pulled} পাওয়া');
    } catch (e) {
      setState(() => _status = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
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
          if (state.activeRole == Role.father ||
              state.activeRole == Role.mother) ...[
            const ListTile(
              leading: Icon(Icons.qr_code),
              title: Text('Pair New Device'),
              subtitle: Text('Generate a QR Code to add Child or partner'),
            ),
            const Divider(),
          ],
          ListTile(
            leading: const Icon(Icons.cloud_sync),
            title: const Text('সার্ভারের সাথে সিঙ্ক'),
            subtitle: const Text('ইন্টারনেট থাকলে চাপুন'),
            onTap: _syncServer,
          ),
          SwitchListTile(
            secondary: const Icon(Icons.settings_bluetooth),
            title: const Text('কাছের ফোনের সাথে সিঙ্ক'),
            subtitle: const Text('ইন্টারনেট ছাড়াই, একই পরিবারের ফোন'),
            value: _engine != null,
            onChanged: (_) => _toggleNearby(),
          ),
          if (_status.isNotEmpty)
            Padding(padding: const EdgeInsets.all(16), child: Text(_status)),
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
