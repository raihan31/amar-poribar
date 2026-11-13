import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/l10n/l10n_x.dart';
import '../../../core/money/money_format.dart';
import '../../../core/speech/bangla_words.dart';
import '../../../core/theme/tokens.dart';
import '../../../presentation/providers/auth_provider.dart';
import '../../../ui/app_header.dart';
import '../../home/state/home_providers.dart';
import '../data/summary_repository.dart';
import '../state/summary_providers.dart';

final _amount = RegExp(r'৳\s?[0-9০-৯][0-9০-৯,]*(?:\.[0-9০-৯]+)?');
final _sentenceBreak = RegExp(r'(?<=[।.])\s+');

/// The first spoken amount in [speech], for the caption: "বিয়াল্লিশ হাজার পাঁচশো টাকা".
String? firstSpokenAmount(String speech) {
  final numberWords = <String>{
    for (var i = 0; i < 100; i++) ...numberToBanglaWords(i).split(' '),
    'হাজার',
    'লাখ',
    'কোটি',
  };
  bool isNumber(String w) => numberWords.contains(w) || w.endsWith('শো');
  final words = speech.split(RegExp(r'\s+'));
  final at = words.indexOf('টাকা');
  if (at <= 0) return null;
  var from = at;
  while (from > 0 && isNumber(words[from - 1])) {
    from--;
  }
  if (from == at) return null;
  final end = words.length > at + 1 && words[at + 1] == 'পয়সা' ? at + 1 : at;
  final tail = end > at && at + 2 < words.length && isNumber(words[at + 2])
      ? at + 2
      : end;
  return words.sublist(from, tail + 1).join(' ');
}

/// B2: the month in a few plain sentences, read aloud on request. Board: Summary.dc.html.
/// Route `/summary`.
class SummaryScreen extends ConsumerStatefulWidget {
  const SummaryScreen({super.key});

  static const double listenHeight = 100;

  @override
  ConsumerState<SummaryScreen> createState() => _SummaryScreenState();
}

class _SummaryScreenState extends ConsumerState<SummaryScreen> {
  bool _speaking = false;

  Future<void> _toggle(String speech) async {
    final voice = ref.read(voiceServiceProvider);
    if (_speaking) {
      setState(() => _speaking = false);
      await voice.stopSpeaking();
      return;
    }
    setState(() => _speaking = true);
    try {
      await voice.speak(speech);
    } finally {
      if (mounted) setState(() => _speaking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final month = ref.watch(homeMonthProvider);
    final summary = ref.watch(monthlySummaryProvider).valueOrNull;
    final year = toBanglaDigits(month.split('-')[0]);
    final monthLabel = '${monthName(month, const Locale('bn'))} $year';
    final example =
        summary == null ? null : firstSpokenAmount(summary.speechText);

    return Scaffold(
      backgroundColor: AppTokens.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AppHeader(title: monthLabel),
              Text(
                l10n.summary_title,
                style: const TextStyle(
                  fontSize: 30,
                  fontWeight: FontWeight.w700,
                  color: AppTokens.green,
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.only(top: 16, bottom: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (summary == null)
                        const Padding(
                          padding: EdgeInsets.all(32),
                          child: Center(
                            child: Icon(
                              Icons.hourglass_empty,
                              size: 40,
                              color: AppTokens.muted,
                            ),
                          ),
                        )
                      else
                        _Card(summary: summary),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          const Icon(
                            Icons.auto_awesome_outlined,
                            size: 20,
                            color: AppTokens.muted,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              summary?.usedAi ?? false
                                  ? l10n.summary_footnoteAi
                                  : l10n.summary_footnote,
                              style: const TextStyle(
                                fontSize: 14,
                                color: AppTokens.muted,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              _ListenBar(
                speaking: _speaking,
                enabled: summary != null,
                onTap: () => _toggle(summary!.speechText),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 10, bottom: 20),
                child: Text(
                  example == null
                      ? l10n.summary_captionPlain
                      : l10n.summary_caption(example),
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 14, color: AppTokens.muted),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.summary});

  final MonthlySummary summary;

  List<InlineSpan> _spans(String sentence, {required bool first}) {
    final spans = <InlineSpan>[];
    var at = 0;
    for (final m in _amount.allMatches(sentence)) {
      if (m.start > at) {
        spans.add(TextSpan(text: sentence.substring(at, m.start)));
      }
      var end = m.end;
      var color = first ? AppTokens.green : AppTokens.ink;
      final rest = sentence.substring(end);
      final more = RegExp(r'^\s(বেশি|more)').firstMatch(rest);
      if (more != null) {
        end += more.end;
        color = AppTokens.danger;
      }
      spans.add(
        TextSpan(
          text: sentence.substring(m.start, end),
          style: TextStyle(fontWeight: FontWeight.w700, color: color),
        ),
      );
      at = end;
      first = false;
    }
    if (at < sentence.length) spans.add(TextSpan(text: sentence.substring(at)));
    return spans;
  }

  @override
  Widget build(BuildContext context) {
    final tipPrefix = context.l10n.summary_tipPrefix;
    final sentences = summary.text
        .split(_sentenceBreak)
        .where((s) => s.trim().isNotEmpty)
        .toList();
    final hasTip = sentences.length > 1 &&
        (sentences.last.startsWith(tipPrefix) ||
            (summary.usedAi && sentences.length >= 4));
    final tip = hasTip ? sentences.removeLast() : null;

    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: AppTokens.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: AppTokens.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < sentences.length; i++) ...[
            if (i > 0) const SizedBox(height: 14),
            Text.rich(
              TextSpan(children: _spans(sentences[i], first: i == 0)),
              style: const TextStyle(
                fontSize: 22,
                height: 1.5,
                color: AppTokens.ink,
              ),
            ),
          ],
          if (tip != null) ...[
            const SizedBox(height: 14),
            Container(
              key: const ValueKey('summary-tip'),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: AppTokens.greenTint,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                tip,
                style: const TextStyle(
                  fontSize: 20,
                  height: 1.5,
                  color: AppTokens.deepGreen,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ListenBar extends StatelessWidget {
  const _ListenBar({
    required this.speaking,
    required this.enabled,
    required this.onTap,
  });

  final bool speaking;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final label = speaking ? l10n.summary_stop : l10n.summary_listen;
    return Semantics(
      container: true,
      button: true,
      enabled: enabled,
      label: label,
      excludeSemantics: true,
      onTap: enabled ? onTap : null,
      child: Material(
        color: AppTokens.amber,
        borderRadius: BorderRadius.circular(50),
        child: InkWell(
          borderRadius: BorderRadius.circular(50),
          onTap: enabled ? onTap : null,
          child: SizedBox(
            height: SummaryScreen.listenHeight,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  speaking ? Icons.stop_circle_outlined : Icons.volume_up,
                  size: 46,
                  color: AppTokens.ink,
                ),
                const SizedBox(width: 14),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                    color: AppTokens.ink,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
