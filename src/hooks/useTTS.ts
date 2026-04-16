import { useRef, useCallback, useState, useEffect } from "react";

export function useTTS() {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const cachedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Preload and cache the preferred voice as soon as voices are available
  useEffect(() => {
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;
      const preferred =
        voices.find((v) => v.lang === "zh-HK") ||
        voices.find((v) => v.lang === "zh-TW") ||
        voices.find((v) => v.lang.startsWith("zh"));
      if (preferred) cachedVoiceRef.current = preferred;
    };

    pickVoice();
    window.speechSynthesis.addEventListener("voiceschanged", pickVoice);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", pickVoice);
  }, []);

  const speak = useCallback((text: string, rate = 1.0, onEnd?: () => void) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-HK";
    utterance.rate = rate * 0.85;
    utterance.pitch = 1.05;
    utterance.volume = 1.0;

    if (cachedVoiceRef.current) utterance.voice = cachedVoiceRef.current;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      onEnd?.();
    };
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking };
}
