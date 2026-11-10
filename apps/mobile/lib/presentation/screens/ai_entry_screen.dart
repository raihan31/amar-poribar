import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/speech/bangla_words.dart';
import '../../core/speech/budget_alerts.dart';
import '../../core/speech/categories.dart';
import '../../data/api/api_client.dart';
import '../../data/database/database.dart';
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
  String? _notice;
  List<PendingEntry> _queued = [];

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
        try {
          var drafts =
              await ref.read(apiClientProvider).parse(familyId, _text.text);
          // Voice entries are marked so reports can tell them apart (FR-VOICE-02).
          if (spoken) {
            drafts = [for (final d in drafts) d.copyWith(source: 'voice')];
          }
          setState(() {
            _drafts = drafts;
            _notice = null;
          });
          // Read the first draft back so it can be checked by ear (FR-VOICE-03).
          if (spoken) await _readBack(drafts.isEmpty ? null : drafts.first);
        } on ApiException catch (e) {
          if (e.status != 0) rethrow;
          // No connection: keep the text and understand it later (FR-SYNC-03).
          await ref
              .read(localStoreProvider)
              .queueText(_text.text, source: spoken ? 'voice' : 'ai_text');
          _text.clear();
          await _loadPending();
          const msg =
              'ইন্টারনেট নেই। লেখাটি রাখা হয়েছে; নেটওয়ার্ক পেলে নিজে থেকে বুঝে নেওয়া হবে।';
          setState(() => _notice = msg);
          if (spoken) await ref.read(voiceServiceProvider).speak(msg);
        }
      });

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _processQueue());
  }

  /// Show items waiting for the AI and entries it has already understood while offline.
  Future<void> _loadPending() async {
    final store = ref.read(localStoreProvider);
    final all = await store.pending();
    final ready = await ref.read(pendingQueueProvider).readyDrafts();
    if (!mounted) return;
    setState(() {
      _queued = [
        for (final p in all)
          if (p.status != 'ready') p,
      ];
      // Keep drafts from this session, replace the queue-backed ones with the latest.
      final session = [
        for (final d in _drafts ?? <TransactionDraft>[])
          if (d.pendingId == null) d,
      ];
      final merged = [...session, ...ready];
      _drafts = merged.isEmpty && _drafts == null ? null : merged;
    });
  }

  /// When online, understand what was typed offline. Quiet if there is no connection.
  Future<void> _processQueue() async {
    final family = ref.read(authProvider).family;
    try {
      if (family != null) {
        await ref.read(pendingQueueProvider).process(family.id);
      }
    } on ApiException catch (e) {
      if (e.isUnauthorized) return; // the normal flow will ask to sign in again
    } catch (_) {
      // best effort
    }
    await _loadPending();
  }

  Future<void> _discard(int i) async {
    final d = _drafts![i];
    if (d.pendingId != null) {
      await ref.read(localStoreProvider).deletePending(d.pendingId!);
    }
    if (!mounted) return;
    setState(() {
      _drafts = [..._drafts!]..removeAt(i);
      if (_drafts!.isEmpty) _drafts = null;
    });
  }

  /// Best-effort background sync after saving; offline is fine, the next manual sync catches up.
  void _syncQuietly() {
    final family = ref.read(authProvider).family;
    if (family == null) return;
    ref
        .read(syncServiceProvider)
        .sync(family.id)
        // Once the server has the entry it can say whether a budget is nearly used up.
        .then((_) => _speakBudgetAlerts(family.id), onError: (_) {});
  }

  /// Say "budget nearly used" / "over budget" when a budget crosses 80% or 100% (FR-BUD-02).
  Future<void> _speakBudgetAlerts(String familyId) async {
    try {
      final store = ref.read(localStoreProvider);
      final month = DateTime.now()
          .toUtc()
          .add(const Duration(hours: 6))
          .toIso8601String()
          .substring(0, 7);
      final raw = await ref.read(apiClientProvider).budgets(familyId);
      final budgets = [
        for (final b in raw)
          BudgetStatus(
            b['categoryId'] as String?,
            (b['nameBn'] ?? '') as String,
            (b['limitPaisa'] as num).toInt(),
            (b['spentPaisa'] as num).toInt(),
            b['level'] as String,
          ),
      ];
      final last = <String, String>{};
      for (final b in budgets) {
        final key = b.categoryId ?? 'overall';
        final v = await store.getMeta('budget_alert:$month:$key');
        if (v != null) last[key] = v;
      }
      for (final a in alertsToSpeak(budgets, last)) {
        await ref.read(voiceServiceProvider).speak(a.text);
        await store.setMeta('budget_alert:$month:${a.key}', a.level);
      }
    } catch (_) {
      // Alerts are a nicety; offline or any error just means no announcement.
    }
  }

  Future<void> _syncNow(FamilyInfo family) => _guard(() async {
        final sync = ref.read(syncServiceProvider);
        await sync.refreshReferenceData(family.id);
        final r = await sync.sync(family.id);
        await ref.read(appStateProvider.notifier).reload();
        await _processQueue();
        if (!mounted) return;
        final rej = r.rejectedReasons.isEmpty
            ? ''
            : ' · ${r.rejectedReasons.length} বাদ';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'সিঙ্ক হয়েছে: ${r.pushed} পাঠানো, ${r.pulled} পাওয়া$rej',
            ),
          ),
        );
      });

  Future<void> _readBack(TransactionDraft? d) {
    final voice = ref.read(voiceServiceProvider);
    if (d == null) return voice.speak('কিছু বোঝা যায়নি। আবার বলুন।');
    return voice.speak(
      draftToSpeech(
        type: d.type,
        amountPaisa: d.amountPaisa,
        categoryName: categoryByKey(d.categoryKey)?.nameBn,
      ),
    );
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

  /// Saves to the on-device database; it reaches other devices and the server by sync.
  Future<void> _confirm(int i) async {
    final d = _drafts![i];
    final store = ref.read(localStoreProvider);
    final notifier = ref.read(appStateProvider.notifier);
    final categoryId = await store.categoryIdForKey(d.categoryKey);
    final accountId = await store.accountIdForType(d.accountType);
    if (d.type == 'income') {
      await notifier.addIncome(
        d.amountTaka,
        note: d.note,
        categoryId: categoryId,
        accountId: accountId,
        source: d.source,
      );
    } else {
      await notifier.addExpense(
        d.amountTaka,
        note: d.note,
        categoryId: categoryId,
        accountId: accountId,
        source: d.source,
      );
    }
    if (d.pendingId != null) await store.deletePending(d.pendingId!);
    _syncQuietly();
    if (!mounted) return;
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
      appBar: AppBar(
        title: const Text('এআই এন্ট্রি / AI entry'),
        actions: [
          if (auth.family != null)
            IconButton(
              icon: const Icon(Icons.sync),
              tooltip: 'সিঙ্ক',
              onPressed: _busy ? null : () => _syncNow(auth.family!),
            ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'লগআউট',
            onPressed: () async {
              await ref.read(authProvider.notifier).signOut();
              if (context.mounted) {
                Navigator.pushReplacementNamed(context, '/login');
              }
            },
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: !auth.signedIn
            ? Center(
                child: ElevatedButton(
                  onPressed: () =>
                      Navigator.pushReplacementNamed(context, '/login'),
                  child: const Text('লগইন করুন'),
                ),
              )
            : auth.family == null
                ? _createFamily()
                : _entry(auth.family!),
      ),
    );
  }

  Widget _createFamily() => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('আপনার পরিবারের নাম দিন'),
          const SizedBox(height: 8),
          TextField(
            controller: _familyName,
            decoration: const InputDecoration(border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          ElevatedButton(
            onPressed: _busy
                ? null
                : () => _guard(
                      () => ref
                          .read(authProvider.notifier)
                          .createFamily(_familyName.text.trim()),
                    ),
            child: const Text('তৈরি করুন'),
          ),
          if (_error != null)
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
        ],
      );

  Widget _entry(FamilyInfo family) => ListView(
        children: [
          SizedBox(
            height: 72,
            child: ElevatedButton.icon(
              icon: Icon(_listening ? Icons.hearing : Icons.mic, size: 32),
              label: Text(
                _listening ? 'শুনছি…' : 'চাপ দিয়ে বলুন',
                style: const TextStyle(fontSize: 20),
              ),
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
              child: Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          if (_drafts != null && _drafts!.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: Text('কিছু বোঝা যায়নি'),
            ),
          if (_notice != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(_notice!),
            ),
          for (final p in _queued)
            Card(
              margin: const EdgeInsets.only(top: 12),
              child: ListTile(
                leading: Icon(
                  p.status == 'failed' ? Icons.error_outline : Icons.schedule,
                ),
                title: Text(
                  p.rawText,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                subtitle: Text(
                  p.status == 'failed'
                      ? 'বোঝা যায়নি: ${p.error ?? ''} — হাতে লিখুন'
                      : 'অপেক্ষায় আছে — নেটওয়ার্ক পেলে বুঝে নেওয়া হবে',
                ),
                trailing: IconButton(
                  icon: const Icon(Icons.close),
                  tooltip: 'বাদ দিন',
                  onPressed: () async {
                    await ref.read(localStoreProvider).deletePending(p.id);
                    await _loadPending();
                  },
                ),
              ),
            ),
          for (var i = 0; i < (_drafts?.length ?? 0); i++) _draftCard(i),
        ],
      );

  /// Month summary in plain words, with a Listen button (FR-VOICE-04).
  Widget _summaryCard(FamilyInfo family) => Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'এই মাসের সারাংশ',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
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
                ],
              ),
              if (_summary != null)
                Text(
                  _summary!.text,
                  style: const TextStyle(fontSize: 16, height: 1.5),
                ),
            ],
          ),
        ),
      );

  Widget _draftCard(int i) {
    final d = _drafts![i];
    final cat = categoryByKey(d.categoryKey);
    return Card(
      margin: const EdgeInsets.only(top: 12),
      child: Column(
        children: [
          ListTile(
            leading:
                Text(cat?.icon ?? '📦', style: const TextStyle(fontSize: 28)),
            title: Text(
              '৳ ${d.amountTaka.toStringAsFixed(2)} · ${cat?.nameBn ?? "ক্যাটাগরি বাছাই করুন"}',
            ),
            subtitle: Text(d.note),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: const Icon(Icons.volume_up),
                  tooltip: 'শুনুন',
                  onPressed: () => _readBack(d),
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 30),
                  tooltip: 'বাদ দিন',
                  onPressed: () => _discard(i),
                ),
                IconButton(
                  icon: const Icon(Icons.check_circle, size: 30),
                  tooltip: 'সংরক্ষণ',
                  onPressed: () => _confirm(i),
                ),
              ],
            ),
          ),
          // Icon grid for people who find reading hard; tapping also says the name (FR-VOICE-06).
          if (d.categoryKey == null)
            Padding(
              padding: const EdgeInsets.all(8),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final c in kDefaultCategories.where(
                    (c) =>
                        c.kind == (d.type == 'income' ? 'income' : 'expense'),
                  ))
                    InkWell(
                      onTap: () {
                        ref.read(voiceServiceProvider).speak(c.nameBn);
                        setState(
                          () => _drafts = [..._drafts!]..[i] =
                              d.copyWith(categoryKey: c.key),
                        );
                      },
                      child: SizedBox(
                        width: 76,
                        child: Column(
                          children: [
                            Text(c.icon, style: const TextStyle(fontSize: 28)),
                            Text(
                              c.nameBn,
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
