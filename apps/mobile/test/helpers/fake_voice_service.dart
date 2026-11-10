import 'package:amar_poribar/core/speech/voice_service.dart';

/// A [VoiceService] for tests: records what was spoken and answers `listen` from a script.
class FakeVoiceService implements VoiceService {
  /// Transcripts handed out by successive `listen` calls. When empty, `listen` hears nothing.
  final List<String> scriptedResults;

  /// Everything passed to [speak], in order.
  final List<String> spoken = [];

  /// Whether the pretend device has a speech recogniser.
  final bool available;

  FakeVoiceService({List<String> listen = const [], this.available = true})
      : scriptedResults = [...listen];

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
