import 'package:flutter_tts/flutter_tts.dart';
import 'package:speech_to_text/speech_to_text.dart';

/// Speech in and out, behind an interface so screens can be tested without a device.
abstract class VoiceService {
  /// False when the device has no speech recogniser (FR-VOICE-07).
  Future<bool> init();
  bool get listening;

  /// Listens for Bangla speech and calls [onResult] with the final transcript.
  /// Audio is handled by the device's own recogniser and is never uploaded by us (FR-VOICE-01).
  Future<void> listen(void Function(String text) onResult,
      {void Function(String error)? onError});
  Future<void> stopListening();

  Future<void> speak(String text);
  Future<void> stopSpeaking();
}

class DeviceVoiceService implements VoiceService {
  final SpeechToText _stt = SpeechToText();
  final FlutterTts _tts = FlutterTts();
  bool _ready = false;

  @override
  bool get listening => _stt.isListening;

  @override
  Future<bool> init() async {
    if (_ready) return true;
    try {
      _ready = await _stt.initialize();
      await _tts.setLanguage('bn-BD');
      await _tts.setSpeechRate(
          0.45); // about 0.9 in the SRS scale; Android's TTS rate is 0..1
    } catch (_) {
      _ready = false;
    }
    return _ready;
  }

  @override
  Future<void> listen(void Function(String text) onResult,
      {void Function(String error)? onError}) async {
    if (!await init()) {
      onError?.call(
          'এই ফোনে কথা শোনার সুবিধা নেই / Speech recognition is not available on this phone');
      return;
    }
    await _stt.listen(
      listenOptions: SpeechListenOptions(partialResults: false, localeId: 'bn_BD'),
      onResult: (r) {
        if (r.finalResult && r.recognizedWords.trim().isNotEmpty) {
          onResult(r.recognizedWords);
        }
      },
    );
  }

  @override
  Future<void> stopListening() => _stt.stop();

  @override
  Future<void> speak(String text) async {
    await init();
    await _tts.speak(text);
  }

  @override
  Future<void> stopSpeaking() => _tts.stop();
}
