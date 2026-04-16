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

  // Split long text into sentences to prevent mobile TTS from cutting off
  const speakChunks = useCallback((chunks: string[], rate: number, onEnd?: () => void) => {
    if (chunks.length === 0) {
      setIsSpeaking(false);
      onEnd?.();
      return;
    }

    const [first, ...rest] = chunks;
    const utterance = new SpeechSynthesisUtterance(first);
    utterance.lang = "zh-HK";
    utterance.rate = rate * 0.85;
    utterance.pitch = 1.05;
    utterance.volume = 1.0;
    if (cachedVoiceRef.current) utterance.voice = cachedVoiceRef.current;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      if (rest.length > 0) {
        speakChunks(rest, rate, onEnd);
      } else {
        setIsSpeaking(false);
        onEnd?.();
      }
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback((text: string, rate = 1.0, onEnd?: () => void) => {
    window.speechSynthesis.cancel();
    // Split on Chinese punctuation and periods to create shorter chunks
    const chunks = text
      .split(/(?<=[。，！？、；：\.\,\!\?])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (chunks.length === 0) {
      onEnd?.();
      return;
    }

    setIsSpeaking(true);
    speakChunks(chunks, rate, onEnd);
  }, [speakChunks]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking };
}
