import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/redirects.dart';
import '../../../core/l10n/l10n_x.dart';
import '../../../core/money/money_format.dart';
import '../../../core/money/numeral_style_provider.dart';
import '../../../core/speech/tutorial.dart';
import '../../../core/speech/voice_service.dart';
import '../../../core/theme/tokens.dart';
import '../../../presentation/providers/auth_provider.dart';
import '../../../presentation/providers/providers.dart';
import '../../../ui/big_button.dart';

const tutorialDoneKey = 'tutorial_done';

/// D2: the 4-step voice-guided tutorial (FR-VOICE-10). Board: Tutorial.dc.html. Route `/tutorial`.
/// Each step is read aloud on arrival and silenced when leaving; it can be replayed or skipped.
class TutorialScreen extends ConsumerStatefulWidget {
  const TutorialScreen({super.key});

  @override
  ConsumerState<TutorialScreen> createState() => _TutorialScreenState();
}

class _TutorialScreenState extends ConsumerState<TutorialScreen> {
  int _step = 0;
  // Kept in a field: Riverpod disposes `ref` before State.dispose() runs.
  late final VoiceService _voice;

  @override
  void initState() {
    super.initState();
    _voice = ref.read(voiceServiceProvider);
    WidgetsBinding.instance.addPostFrameCallback((_) => _speak());
  }

  @override
  void dispose() {
    _voice.stopSpeaking();
    super.dispose();
  }

  Future<void> _speak() => _voice.speak(kTutorialSteps[_step]);

  Future<void> _go(int delta) async {
    final next = _step + delta;
    if (next < 0) return;
    await _voice.stopSpeaking();
    if (next >= kTutorialSteps.length) return _finish();
    if (!mounted) return;
    setState(() => _step = next);
    await _speak();
  }

  Future<void> _finish() async {
    await _voice.stopSpeaking();
    await ref.read(localStoreProvider).setMeta(tutorialDoneKey, '1');
    ref.read(tutorialDoneProvider.notifier).state = true;
    if (mounted) context.go(Routes.home);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final style = ref.watch(numeralStyleProvider);
    final total = kTutorialSteps.length;
    final last = _step == total - 1;
    String digits(int n) =>
        style == NumeralStyle.bangla ? toBanglaDigits('$n') : '$n';
    final title = [
      l10n.tutorial_title1,
      l10n.tutorial_title2,
      l10n.tutorial_title3,
      l10n.tutorial_title4,
    ][_step];
    return Scaffold(
      backgroundColor: AppTokens.bg,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, box) => SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: box.maxHeight),
              child: IntrinsicHeight(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        for (var i = 0; i < total; i++)
                          Container(
                            key: Key('tutorial_dot_$i'),
                            margin: const EdgeInsets.only(right: 6),
                            width: i == _step ? 28 : 12,
                            height: 12,
                            decoration: BoxDecoration(
                              color: i <= _step
                                  ? AppTokens.green
                                  : AppTokens.switchOff,
                              borderRadius: BorderRadius.circular(6),
                            ),
                          ),
                        const SizedBox(width: 2),
                        Text(
                          l10n.tutorial_counter(
                            digits(_step + 1),
                            digits(total),
                          ),
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: AppTokens.ink,
                          ),
                        ),
                        const Spacer(),
                        TextButton(
                          key: const Key('tutorial_skip'),
                          style: TextButton.styleFrom(
                            minimumSize: const Size(0, AppTokens.touchMin),
                            foregroundColor: AppTokens.muted,
                          ),
                          onPressed: _finish,
                          child: Text(
                            l10n.tutorial_skip,
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w600,
                              decoration: TextDecoration.underline,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      title,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        color: AppTokens.green,
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Center(
                      child: ExcludeSemantics(
                        child: CustomPaint(
                          key: Key('tutorial_mic_picture'),
                          size: Size(220, 220),
                          painter: _MicPainter(),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      key: const Key('tutorial_caption'),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 18,
                        vertical: 16,
                      ),
                      decoration: BoxDecoration(
                        color: AppTokens.white,
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(color: AppTokens.border, width: 2),
                      ),
                      child: Text(
                        kTutorialSteps[_step],
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          height: 1.35,
                          color: AppTokens.ink,
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    BigButton(
                      key: const Key('tutorial_listen_again'),
                      label: l10n.tutorial_listenAgain,
                      icon: Icons.volume_up_outlined,
                      style: BigButtonStyle.quiet,
                      height: 64,
                      onPressed: _speak,
                    ),
                    const Spacer(),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        SizedBox(
                          width: 104,
                          child: BigButton(
                            key: const Key('tutorial_back'),
                            label: l10n.tutorial_back,
                            style: BigButtonStyle.outline,
                            height: 72,
                            onPressed: _step == 0 ? null : () => _go(-1),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: BigButton(
                            key: const Key('tutorial_next'),
                            label:
                                last ? l10n.tutorial_start : l10n.tutorial_next,
                            icon: Icons.chevron_right,
                            height: 72,
                            onPressed: () => _go(1),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The big microphone picture: amber-tint disc, amber disc, ink microphone (no image assets).
class _MicPainter extends CustomPainter {
  const _MicPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    canvas.drawCircle(c, size.width / 2, Paint()..color = AppTokens.amberTint);
    canvas.drawCircle(
      c,
      size.width * 75 / 220,
      Paint()..color = AppTokens.amber,
    );
    final ink = Paint()
      ..color = AppTokens.ink
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6
      ..strokeCap = StrokeCap.round;
    const u = 80 / 24; // the board draws the glyph on a 24-unit grid at 80 px
    Offset p(double x, double y) => c + Offset((x - 12) * u, (y - 12) * u);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromPoints(p(9, 3), p(15, 15)),
        const Radius.circular(3 * u),
      ),
      ink,
    );
    canvas.drawArc(Rect.fromPoints(p(5, 4), p(19, 18)), 0, math.pi, false, ink);
    canvas.drawLine(p(12, 18), p(12, 21), ink);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
