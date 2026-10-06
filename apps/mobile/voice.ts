import * as Speech from "expo-speech";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

/**
 * Device speech services (SRS FR-VOICE-01, FR-VOICE-04).
 * Recognition uses the phone's own recogniser (Google on most Android phones, which supports bn-BD),
 * so audio never reaches our servers and costs nothing.
 * Note: expo-speech-recognition needs a development build (`npx expo run:android`), not Expo Go.
 */

export async function startListening(lang = "bn-BD"): Promise<boolean> {
  const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!perm.granted) return false;
  ExpoSpeechRecognitionModule.start({ lang, interimResults: false, continuous: false });
  return true;
}

export function stopListening() {
  ExpoSpeechRecognitionModule.stop();
}

export function speak(text: string, lang = "bn-BD") {
  Speech.stop();
  // Slightly slower than default is easier to follow.
  Speech.speak(text, { language: lang, rate: 0.9 });
}

export function stopSpeaking() {
  Speech.stop();
}
