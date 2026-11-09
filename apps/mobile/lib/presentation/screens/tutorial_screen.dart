import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/speech/tutorial.dart';
import '../../core/speech/voice_service.dart';
import '../providers/auth_provider.dart';
import '../providers/providers.dart';

const tutorialDoneKey = 'tutorial_done';

/// First-time walkthrough. Every step is read aloud; big Next / Back / Replay buttons, and it can be skipped.
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

  Future<void> _speak() =>
      _voice.speak(kTutorialSteps[_step]);

  Future<void> _go(int delta) async {
    final next = _step + delta;
    if (next < 0) return;
    if (next >= kTutorialSteps.length) return _finish();
    setState(() => _step = next);
    await _speak();
  }

  Future<void> _finish() async {
    await _voice.stopSpeaking();
    await ref.read(localStoreProvider).setMeta(tutorialDoneKey, '1');
    if (mounted) Navigator.pushReplacementNamed(context, '/ai-entry');
  }

  @override
  Widget build(BuildContext context) {
    final last = _step == kTutorialSteps.length - 1;
    return Scaffold(
      appBar: AppBar(
        title: Text(
            'কীভাবে ব্যবহার করবেন (${_step + 1}/${kTutorialSteps.length})'),
        actions: [TextButton(onPressed: _finish, child: const Text('বাদ দিন'))],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Center(
                child: Text(kTutorialSteps[_step],
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 24, height: 1.6)),
              ),
            ),
            SizedBox(
              height: 64,
              child: OutlinedButton.icon(
                icon: const Icon(Icons.volume_up, size: 30),
                label: const Text('আবার শুনুন', style: TextStyle(fontSize: 20)),
                onPressed: _speak,
              ),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                child: SizedBox(
                  height: 64,
                  child: OutlinedButton(
                    onPressed: _step == 0 ? null : () => _go(-1),
                    child: const Text('পেছনে', style: TextStyle(fontSize: 20)),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: SizedBox(
                  height: 64,
                  child: FilledButton(
                    onPressed: () => _go(1),
                    child: Text(last ? 'শুরু করুন' : 'পরের ধাপ',
                        style: const TextStyle(fontSize: 20)),
                  ),
                ),
              ),
            ]),
          ],
        ),
      ),
    );
  }
}
