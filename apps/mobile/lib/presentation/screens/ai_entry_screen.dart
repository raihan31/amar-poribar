import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/api/api_client.dart';
import '../providers/auth_provider.dart';
import '../providers/providers.dart';

/// Type a sentence or paste a bKash/Nagad/Rocket SMS, check the proposed entries, then save (FR-AI-01, -02, -05).
class AiEntryScreen extends ConsumerStatefulWidget {
  const AiEntryScreen({super.key});

  @override
  ConsumerState<AiEntryScreen> createState() => _AiEntryScreenState();
}

class _AiEntryScreenState extends ConsumerState<AiEntryScreen> {
  final _text = TextEditingController();
  final _familyName = TextEditingController();
  List<TransactionDraft>? _drafts;
  bool _busy = false;
  String? _error;

  Future<void> _guard(Future<void> Function() fn) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await fn();
    } on ApiException catch (e) {
      if (e.isUnauthorized) {
        await ref.read(authProvider.notifier).signOut();
        if (mounted) Navigator.pushReplacementNamed(context, '/login');
        return;
      }
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _parse(String familyId) => _guard(() async {
        final drafts = await ref.read(apiClientProvider).parse(familyId, _text.text);
        setState(() => _drafts = drafts);
      });

  /// Saves into the app's current state. The local database is not wired yet (see #15 follow-up work).
  void _confirm(int i) {
    final d = _drafts![i];
    final notifier = ref.read(appStateProvider.notifier);
    if (d.type == 'income') {
      notifier.addIncome(d.amountTaka);
    } else {
      notifier.addExpense(d.amountTaka);
    }
    setState(() {
      _drafts = [..._drafts!]..removeAt(i);
      if (_drafts!.isEmpty) {
        _drafts = null;
        _text.clear();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('এআই এন্ট্রি / AI entry'), actions: [
        IconButton(
          icon: const Icon(Icons.logout),
          tooltip: 'লগআউট',
          onPressed: () async {
            await ref.read(authProvider.notifier).signOut();
            if (context.mounted) Navigator.pushReplacementNamed(context, '/login');
          },
        ),
      ]),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: !auth.signedIn
            ? Center(child: ElevatedButton(onPressed: () => Navigator.pushReplacementNamed(context, '/login'), child: const Text('লগইন করুন')))
            : auth.family == null
                ? _createFamily()
                : _entry(auth.family!),
      ),
    );
  }

  Widget _createFamily() => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('আপনার পরিবারের নাম দিন'),
        const SizedBox(height: 8),
        TextField(controller: _familyName, decoration: const InputDecoration(border: OutlineInputBorder())),
        const SizedBox(height: 12),
        ElevatedButton(
          onPressed: _busy ? null : () => _guard(() => ref.read(authProvider.notifier).createFamily(_familyName.text.trim())),
          child: const Text('তৈরি করুন'),
        ),
        if (_error != null) Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
      ]);

  Widget _entry(FamilyInfo family) => ListView(children: [
        TextField(
          controller: _text,
          minLines: 3,
          maxLines: 6,
          decoration: const InputDecoration(
            hintText: 'যেমন: আজ বাজারে ৮৫০ টাকা ক্যাশে, অথবা bKash SMS পেস্ট করুন',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 8),
        ElevatedButton(
          onPressed: _busy ? null : () => _parse(family.id),
          child: Text(_busy ? '…' : 'বুঝে নাও'),
        ),
        if (_error != null)
          Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
        if (_drafts != null && _drafts!.isEmpty) const Padding(padding: EdgeInsets.only(top: 12), child: Text('কিছু বোঝা যায়নি')),
        for (var i = 0; i < (_drafts?.length ?? 0); i++)
          Card(
            margin: const EdgeInsets.only(top: 12),
            child: ListTile(
              title: Text('৳ ${_drafts![i].amountTaka.toStringAsFixed(2)} · ${_drafts![i].categoryKey ?? "ক্যাটাগরি নেই"}'),
              subtitle: Text(_drafts![i].note),
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                IconButton(
                  icon: const Icon(Icons.close),
                  tooltip: 'বাদ দিন',
                  onPressed: () => setState(() {
                    _drafts = [..._drafts!]..removeAt(i);
                    if (_drafts!.isEmpty) _drafts = null;
                  }),
                ),
                IconButton(icon: const Icon(Icons.check_circle), tooltip: 'সংরক্ষণ', onPressed: () => _confirm(i)),
              ]),
            ),
          ),
      ]);
}
