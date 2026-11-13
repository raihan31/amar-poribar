import 'package:flutter_tts/flutter_tts.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:url_launcher/url_launcher.dart';

/// What this phone can do with speech (FR-VOICE-07).
class VoiceCapabilities {
  const VoiceCapabilities({
    required this.canListen,
    required this.hasBanglaRecognizer,
    required this.canSpeak,
    required this.hasBanglaVoice,
  });

  final bool canListen;
  final bool hasBanglaRecognizer;
  final bool canSpeak;
  final bool hasBanglaVoice;

  /// Everything works.
  static const all = VoiceCapabilities(
    canListen: true,
    hasBanglaRecognizer: true,
    canSpeak: true,
    hasBanglaVoice: true,
  );

  /// Mic buttons cannot work: send the person to typing.
  bool get needsTypingFallback => !canListen || !hasBanglaRecognizer;

  /// Results are shown as text, without reading them aloud.
  bool get ttsMissingBangla => !canSpeak || !hasBanglaVoice;

  @override
  bool operator ==(Object other) =>
      other is VoiceCapabilities &&
      other.canListen == canListen &&
      other.hasBanglaRecognizer == hasBanglaRecognizer &&
      other.canSpeak == canSpeak &&
      other.hasBanglaVoice == hasBanglaVoice;

  @override
  int get hashCode =>
      Object.hash(canListen, hasBanglaRecognizer, canSpeak, hasBanglaVoice);
}

/// Speech in and out, behind an interface so screens can be tested without a device.
abstract class VoiceService {
  /// False when the device has no speech recogniser (FR-VOICE-07).
  Future<bool> init();
  bool get listening;

  /// Listens for Bangla speech and calls [onResult] with the final transcript.
  /// Audio is handled by the device's own recogniser and is never uploaded by us (FR-VOICE-01).
  Future<void> listen(
    void Function(String text) onResult, {
    void Function(String error)? onError,
  });
  Future<void> stopListening();

  Future<void> speak(String text);
  Future<void> stopSpeaking();

  /// Probes the phone for a Bangla recogniser and a Bangla voice (FR-VOICE-07). Never throws.
  Future<VoiceCapabilities> capabilities();

  /// Opens the Google text-to-speech page in the Play Store so a Bangla voice can be installed.
  Future<void> openVoiceInstall();
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
        0.45,
      ); // about 0.9 in the SRS scale; Android's TTS rate is 0..1
    } catch (_) {
      _ready = false;
    }
    return _ready;
  }

  @override
  Future<void> listen(
    void Function(String text) onResult, {
    void Function(String error)? onError,
  }) async {
    if (!await init()) {
      onError?.call(
        'এই ফোনে কথা শোনার সুবিধা নেই / Speech recognition is not available on this phone',
      );
      return;
    }
    await _stt.listen(
      listenOptions:
          SpeechListenOptions(partialResults: false, localeId: 'bn_BD'),
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

  @override
  Future<VoiceCapabilities> capabilities() async {
    var canListen = false;
    var bnRecognizer = false;
    try {
      canListen = await _stt.initialize();
      if (canListen) {
        final locales = await _stt.locales();
        bnRecognizer = locales.any((l) {
          final id = l.localeId.replaceAll('-', '_').toLowerCase();
          return id == 'bn_bd' || id == 'bn_in';
        });
      }
    } catch (_) {
      canListen = false;
    }
    var canSpeak = false;
    var bnVoice = false;
    try {
      final available = await _tts.isLanguageAvailable('bn-BD');
      bnVoice = available == true || available == 1;
      if (!bnVoice) {
        final voices = await _tts.getVoices;
        if (voices is List) {
          bnVoice = voices.any((v) {
            final loc = v is Map ? '${v['locale']}'.toLowerCase() : '';
            return loc.startsWith('bn');
          });
        }
      }
      canSpeak = true;
    } catch (_) {
      canSpeak = false;
    }
    return VoiceCapabilities(
      canListen: canListen,
      hasBanglaRecognizer: bnRecognizer,
      canSpeak: canSpeak,
      hasBanglaVoice: bnVoice,
    );
  }

  @override
  Future<void> openVoiceInstall() async {
    final market = Uri.parse('market://details?id=com.google.android.tts');
    final web = Uri.parse(
      'https://play.google.com/store/apps/details?id=com.google.android.tts',
    );
    try {
      if (await launchUrl(market, mode: LaunchMode.externalApplication)) return;
    } catch (_) {
      // No Play Store app: use the web page below.
    }
    try {
      await launchUrl(web, mode: LaunchMode.externalApplication);
    } catch (_) {
      // Nothing can open a link; the screen keeps working for typing.
    }
  }
}
