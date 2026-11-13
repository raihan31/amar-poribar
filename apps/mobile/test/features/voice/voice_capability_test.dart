import 'package:amar_poribar/core/speech/voice_service.dart';
import 'package:amar_poribar/features/voice/state/voice_capability_provider.dart';
import 'package:amar_poribar/presentation/providers/auth_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fake_voice_service.dart';

const noBangla = VoiceCapabilities(
  canListen: true,
  hasBanglaRecognizer: false,
  canSpeak: true,
  hasBanglaVoice: false,
);

void main() {
  ProviderContainer containerWith(FakeVoiceService v) {
    final c = ProviderContainer(
      overrides: [voiceServiceProvider.overrideWithValue(v)],
    );
    addTearDown(c.dispose);
    return c;
  }

  test('full capabilities need no fallback', () async {
    final c = containerWith(FakeVoiceService());
    final caps = await c.read(voiceCapabilityProvider.future);
    expect(caps.needsTypingFallback, isFalse);
    expect(caps.ttsMissingBangla, isFalse);
  });

  test('no Bangla recogniser needs the typing fallback', () async {
    final c = containerWith(FakeVoiceService(capabilities: noBangla));
    final caps = await c.read(voiceCapabilityProvider.future);
    expect(caps.needsTypingFallback, isTrue);
    expect(caps.ttsMissingBangla, isTrue);
  });

  test('a phone that cannot listen at all needs the fallback', () async {
    final c = containerWith(
      FakeVoiceService(
        capabilities: const VoiceCapabilities(
          canListen: false,
          hasBanglaRecognizer: true,
          canSpeak: true,
          hasBanglaVoice: true,
        ),
      ),
    );
    expect(
      (await c.read(voiceCapabilityProvider.future)).needsTypingFallback,
      isTrue,
    );
  });

  test('only a missing Bangla voice keeps the mic working', () async {
    final c = containerWith(
      FakeVoiceService(
        capabilities: const VoiceCapabilities(
          canListen: true,
          hasBanglaRecognizer: true,
          canSpeak: true,
          hasBanglaVoice: false,
        ),
      ),
    );
    final caps = await c.read(voiceCapabilityProvider.future);
    expect(caps.needsTypingFallback, isFalse);
    expect(caps.ttsMissingBangla, isTrue);
  });

  test('probing again after an install picks up the new voice', () async {
    final v = FakeVoiceService(capabilities: noBangla);
    final c = containerWith(v);
    await c.read(voiceCapabilityProvider.future);
    await c.read(voiceCapabilityProvider.notifier).openInstall();
    expect(v.installOpens, 1);
    v.caps = VoiceCapabilities.all;
    await c.read(voiceCapabilityProvider.notifier).refresh();
    expect(c.read(voiceCapabilityProvider).value!.needsTypingFallback, isFalse);
  });
}
