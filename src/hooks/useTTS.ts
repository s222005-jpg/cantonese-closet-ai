import { useRef, useCallback, useState, useEffect } from "react";

export function useTTS() {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const resumeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load voices — they may arrive asynchronously
  useEffect(() => {
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  // Chrome mobile bug: speechSynthesis pauses after ~15s.
  // Workaround: periodically call resume() while speaking.
  const startResumeTimer = useCallback(() => {
    if (resumeTimerRef.current) clearInterval(resumeTimerRef.current);
    resumeTimerRef.current = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.resume();
      }
    }, 5000);
  }, []);

  const stopResumeTimer = useCallback(() => {
    if (resumeTimerRef.current) {
      clearInterval(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const speak = useCallback((text: string, rate = 1.0, onEnd?: () => void) => {
    window.speechSynthesis.cancel();
    stopResumeTimer();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-HK";
    utterance.rate = rate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Pick a zh-HK / zh-TW voice
    const voices = voicesRef.current.length > 0
      ? voicesRef.current
      : window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.lang === "zh-HK" || v.lang === "zh-TW" || v.lang.startsWith("zh")
    );
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => {
      setIsSpeaking(true);
      startResumeTimer();
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      stopResumeTimer();
      onEnd?.();
    };
    utterance.onerror = (e) => {
      console.warn("TTS error:", e);
      setIsSpeaking(false);
      stopResumeTimer();
      onEnd?.();
    };

    utteranceRef.current = utterance;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [startResumeTimer, stopResumeTimer]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    stopResumeTimer();
    setIsSpeaking(false);
  }, [stopResumeTimer]);

  // Cleanup
  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore — some browsers throw during teardown
      }
      if (resumeTimerRef.current) clearInterval(resumeTimerRef.current);
    };
  }, []);

  return { speak, stop, isSpeaking };
}