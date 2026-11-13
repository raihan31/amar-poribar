import 'package:amar_poribar/core/speech/voice_service.dart';

/// A [VoiceService] for tests: records what was spoken and answers `listen` from a script.
class FakeVoiceService implements VoiceService {
  /// Transcripts handed out by successive `listen` calls. When empty, `listen` hears nothing.
  final List<String> scriptedResults;

  /// Everything passed to [speak], in order.
  final List<String> spoken = [];

  /// Whether the pretend device has a speech recogniser.
  final bool available;

  /// What [capabilities] reports. Tests change it to script a device (e.g. after an install).
  VoiceCapabilities caps;

  /// How many times [openVoiceInstall] was called.
  int installOpens = 0;

  FakeVoiceService({
    List<String> listen = const [],
    this.available = true,
    VoiceCapabilities? capabilities,
  })  : scriptedResults = [...listen],
        caps = capabilities ?? VoiceCapabilities.all;

  @override
  Future<VoiceCapabilities> capabilities() async => caps;

  @override
  Future<void> openVoiceInstall() async => installOpens++;

  @override
  Future<bool> init() async => available;

  @override
  bool get listening => false;

  @override
  Future<void> listen(
    void Function(String text) onResult, {
    void Function(String error)? onError,
  }) async {
    if (!available) {
      onError?.call('speech recognition is not available');
      return;
    }
    if (scriptedResults.isNotEmpty) onResult(scriptedResults.removeAt(0));
  }

  @override
  Future<void> stopListening() async {}

  @override
  Future<void> speak(String text) async => spoken.add(text);

  @override
  Future<void> stopSpeaking() async {}
}
