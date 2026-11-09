import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/speech/bangla_words.dart';
import '../../core/speech/categories.dart';
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
  bool _listening = false;
  MonthlySummary? _summary;
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

  Future<void> _parse(String familyId, {bool spoken = false}) =>
      _guard(() async {
        var drafts =
            await ref.read(apiClientProvider).parse(familyId, _text.text);
        // Voice entries are marked so reports can tell them apart (FR-VOICE-02).
        if (spoken)
          drafts = [for (final d in drafts) d.copyWith(source: 'voice')];
        setState(() => _drafts = drafts);
        // Read the first draft back so it can be checked by ear (FR-VOICE-03).
        if (spoken) await _readBack(drafts.isEmpty ? null : drafts.first);
      });

  Future<void> _readBack(TransactionDraft? d) {
    final voice = ref.read(voiceServiceProvider);
    if (d == null) return voice.speak('কিছু বোঝা যায়নি। আবার বলুন।');
    return voice.speak(draftToSpeech(
        type: d.type,
        amountPaisa: d.amountPaisa,
        categoryName: categoryByKey(d.categoryKey)?.nameBn));
  }

  Future<void> _listen(String familyId) async {
    final voice = ref.read(voiceServiceProvider);
    await voice.stopSpeaking();
    setState(() {
      _listening = true;
      _error = null;
    });
    await voice.listen(
      (heard) {
        if (!mounted) return;
        setState(() {
          _text.text = heard;
          _listening = false;
        });
        _parse(familyId, spoken: true);
      },
      onError: (e) {
        if (mounted) {
          setState(() {
            _listening = false;
            _error = e;
          });
        }
      },
    );
  }

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
            if (context.mounted)
              Navigator.pushReplacementNamed(context, '/login');
          },
        ),
      ]),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: !auth.signedIn
            ? Center(
                child: ElevatedButton(
                    onPressed: () =>
                        Navigator.pushReplacementNamed(context, '/login'),
                    child: const Text('লগইন করুন')))
            : auth.family == null
                ? _createFamily()
                : _entry(auth.family!),
      ),
    );
  }

  Widget _createFamily() =>
      Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('আপনার পরিবারের নাম দিন'),
        const SizedBox(height: 8),
        TextField(
            controller: _familyName,
            decoration: const InputDecoration(border: OutlineInputBorder())),
        const SizedBox(height: 12),
        ElevatedButton(
          onPressed: _busy
              ? null
              : () => _guard(() => ref
                  .read(authProvider.notifier)
                  .createFamily(_familyName.text.trim())),
          child: const Text('তৈরি করুন'),
        ),
        if (_error != null)
          Text(_error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error)),
      ]);

  Widget _entry(FamilyInfo family) => ListView(children: [
        SizedBox(
          height: 72,
          child: ElevatedButton.icon(
            icon: Icon(_listening ? Icons.hearing : Icons.mic, size: 32),
            label: Text(_listening ? 'শুনছি…' : 'চাপ দিয়ে বলুন',
                style: const TextStyle(fontSize: 20)),
            onPressed: _busy
                ? null
                : () => _listening
                    ? ref.read(voiceServiceProvider).stopListening()
                    : _listen(family.id),
          ),
        ),
        const SizedBox(height: 12),
        _summaryCard(family),
        const SizedBox(height: 12),
        TextField(
          controller: _text,
          minLines: 3,
          maxLines: 6,
          decoration: const InputDecoration(
            hintText:
                'যেমন: আজ বাজারে ৮৫০ টাকা ক্যাশে, অথবা bKash SMS পেস্ট করুন',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 8),
        ElevatedButton(
          onPressed: _busy ? null : () => _parse(family.id),
          child: Text(_busy ? '…' : 'বুঝে নাও'),
        ),
        if (_error != null)
          Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_error!,
                  style:
                      TextStyle(color: Theme.of(context).colorScheme.error))),
        if (_drafts != null && _drafts!.isEmpty)
          const Padding(
              padding: EdgeInsets.only(top: 12),
              child: Text('কিছু বোঝা যায়নি')),
        for (var i = 0; i < (_drafts?.length ?? 0); i++) _draftCard(i),
      ]);

  /// Month summary in plain words, with a Listen button (FR-VOICE-04).
  Widget _summaryCard(FamilyInfo family) => Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const Text('এই মাসের সারাংশ',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              TextButton.icon(
                icon: const Icon(Icons.volume_up),
                label: const Text('শুনুন'),
                onPressed: () => _guard(() async {
                  final s = _summary ??
                      await ref.read(apiClientProvider).summary(family.id);
                  setState(() => _summary = s);
                  await ref.read(voiceServiceProvider).speak(s.speechText);
                }),
              ),
            ]),
            if (_summary != null)
              Text(_summary!.text,
                  style: const TextStyle(fontSize: 16, height: 1.5)),
          ]),
        ),
      );

  Widget _draftCard(int i) {
    final d = _drafts![i];
    final cat = categoryByKey(d.categoryKey);
    return Card(
      margin: const EdgeInsets.only(top: 12),
      child: Column(children: [
        ListTile(
          leading:
              Text(cat?.icon ?? '📦', style: const TextStyle(fontSize: 28)),
          title: Text(
              '৳ ${d.amountTaka.toStringAsFixed(2)} · ${cat?.nameBn ?? "ক্যাটাগরি বাছাই করুন"}'),
          subtitle: Text(d.note),
          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
            IconButton(
                icon: const Icon(Icons.volume_up),
                tooltip: 'শুনুন',
                onPressed: () => _readBack(d)),
            IconButton(
              icon: const Icon(Icons.close, size: 30),
              tooltip: 'বাদ দিন',
              onPressed: () => setState(() {
                _drafts = [..._drafts!]..removeAt(i);
                if (_drafts!.isEmpty) _drafts = null;
              }),
            ),
            IconButton(
                icon: const Icon(Icons.check_circle, size: 30),
                tooltip: 'সংরক্ষণ',
                onPressed: () => _confirm(i)),
          ]),
        ),
        // Icon grid for people who find reading hard; tapping also says the name (FR-VOICE-06).
        if (d.categoryKey == null)
          Padding(
            padding: const EdgeInsets.all(8),
            child: Wrap(spacing: 8, runSpacing: 8, children: [
              for (final c in kDefaultCategories.where(
                  (c) => c.kind == (d.type == 'income' ? 'income' : 'expense')))
                InkWell(
                  onTap: () {
                    ref.read(voiceServiceProvider).speak(c.nameBn);
                    setState(() => _drafts = [..._drafts!]..[i] =
                        d.copyWith(categoryKey: c.key));
                  },
                  child: SizedBox(
                    width: 76,
                    child: Column(children: [
                      Text(c.icon, style: const TextStyle(fontSize: 28)),
                      Text(c.nameBn,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 11))
                    ]),
                  ),
                ),
            ]),
          ),
      ]),
    );
  }
}
