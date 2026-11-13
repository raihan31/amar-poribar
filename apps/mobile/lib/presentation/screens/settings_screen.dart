import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/redirects.dart';
import '../../core/l10n/l10n_x.dart';
import '../../core/l10n/locale_controller.dart';
import '../../data/sync/nearby_transport.dart';
import '../../data/sync/p2p_transport.dart';
import '../../data/sync/peer_sync_engine.dart';
import '../../features/family/state/active_family.dart';
import '../../features/family/state/family_providers.dart';
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
        title: Text(ctx.l10n.sync_nearby_askTitle),
        content: Text(ctx.l10n.sync_nearby_askBody(peer.name, peer.authCode)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(ctx.l10n.common_no),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(ctx.l10n.common_yes),
          ),
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
    final family = ref.read(activeFamilyProvider);
    if (family == null) {
      setState(() => _status = context.l10n.sync_nearby_needLogin);
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
      setState(() => _status = context.l10n.sync_nearby_failed);
    }
  }

  Future<void> _syncServer() async {
    final family = ref.read(activeFamilyProvider);
    if (family == null) {
      setState(() => _status = context.l10n.sync_server_needLogin);
      return;
    }
    try {
      final sync = ref.read(syncServiceProvider);
      await sync.refreshReferenceData(family.id);
      final r = await sync.sync(family.id);
      await ref.read(appStateProvider.notifier).reload();
      if (!mounted) return;
      setState(
        () => _status = context.l10n.sync_server_done(r.pushed, r.pulled),
      );
    } catch (e) {
      setState(() => _status = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = ref.watch(currentRoleProvider);

    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.settings_title)),
      body: ListView(
        children: [
          ListTile(
            leading: const Icon(Icons.person),
            title: Text(context.l10n.settings_role_title),
            subtitle: Text(role.name.toUpperCase()),
            trailing: const Icon(Icons.chevron_right),
          ),
          const Divider(),
          if (role.canManageMembers) ...[
            ListTile(
              leading: const Icon(Icons.qr_code),
              title: Text(context.l10n.settings_pair_title),
              subtitle: Text(context.l10n.settings_pair_subtitle),
            ),
            const Divider(),
          ],
          ListTile(
            leading: const Icon(Icons.record_voice_over),
            title: Text(context.l10n.settings_tutorial_title),
            onTap: () => context.push(Routes.tutorial),
          ),
          ListTile(
            leading: const Icon(Icons.language),
            title: Text(context.l10n.settings_language_title),
            subtitle: Text(context.l10n.settings_language_switch),
            onTap: () => ref.read(localeProvider.notifier).setLocale(
                  Localizations.localeOf(context).languageCode == 'bn'
                      ? const Locale('en')
                      : const Locale('bn'),
                ),
          ),
          ListTile(
            leading: const Icon(Icons.cloud_sync),
            title: Text(context.l10n.sync_server_title),
            subtitle: Text(context.l10n.sync_server_subtitle),
            onTap: _syncServer,
          ),
          SwitchListTile(
            secondary: const Icon(Icons.settings_bluetooth),
            title: Text(context.l10n.sync_nearby_title),
            subtitle: Text(context.l10n.sync_nearby_subtitle),
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
