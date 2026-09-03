export function isSpeechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "hi-IN") ||
    voices.find((v) => v.lang?.startsWith("hi")) ||
    voices.find((v) => v.lang === "en-IN") ||
    null
  );
}

export function speakText(text, { onEnd } = {}) {
  if (!isSpeechSupported()) return false;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "hi-IN";
  utterance.rate = 0.95;
  utterance.pitch = 1;

  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  if (onEnd) utterance.onend = onEnd;

  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}
