import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/redirects.dart';
import '../../../core/speech/voice_service.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../../presentation/providers/auth_provider.dart';
import '../../../presentation/providers/providers.dart';

/// Meta key set once the fallback screen has been shown from a mic button.
const kVoiceFallbackSeenKey = 'voice_fallback_seen';

/// What the phone can do with speech. Probed once when first read (app start) and again with
/// [VoiceCapabilityNotifier.refresh], for example after returning from the Play Store.
class VoiceCapabilityNotifier extends AsyncNotifier<VoiceCapabilities> {
  @override
  Future<VoiceCapabilities> build() =>
      ref.read(voiceServiceProvider).capabilities();

  Future<void> refresh() async {
    state = AsyncData(await ref.read(voiceServiceProvider).capabilities());
  }

  /// Opens the Play Store page for the Bangla voice.
  Future<void> openInstall() =>
      ref.read(voiceServiceProvider).openVoiceInstall();
}

final voiceCapabilityProvider =
    AsyncNotifierProvider<VoiceCapabilityNotifier, VoiceCapabilities>(
  VoiceCapabilityNotifier.new,
);

/// Call from every mic button before listening. Returns true when listening may go ahead.
///
/// Without a Bangla recogniser the first tap opens `/voice-fallback`; later taps only show a
/// small "লিখে দিন" hint instead of failing (FR-VOICE-07).
Future<bool> micMayListen(BuildContext context, WidgetRef ref) async {
  final caps = await ref.read(voiceCapabilityProvider.future);
  if (!caps.needsTypingFallback) return true;
  final store = ref.read(localStoreProvider);
  final seen = await store.getMeta(kVoiceFallbackSeenKey) == '1';
  if (!context.mounted) return false;
  if (!seen) {
    await store.setMeta(kVoiceFallbackSeenKey, '1');
    if (context.mounted) await context.push(Routes.voiceFallback);
  } else {
    final l10n = AppLocalizations.of(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(l10n.voice_fallback_hint)),
    );
  }
  return false;
}
