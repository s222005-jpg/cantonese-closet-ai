import { useRef, useCallback, useState, useEffect } from "react";

export function useTTS() {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const resumeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unlockedRef = useRef(false);

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

  // Call this during a user gesture (button click) to unlock TTS on mobile
  const warmUp = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    // Speak a silent/empty utterance to unlock the audio context
    const u = new SpeechSynthesisUtterance("");
    u.volume = 0;
    u.lang = "zh-HK";
    try {
      window.speechSynthesis.speak(u);
      // Cancel immediately — we just need the gesture association
      setTimeout(() => window.speechSynthesis.cancel(), 100);
    } catch {
      // ignore
    }
  }, []);

  const speak = useCallback((text: string, rate = 1.0, onEnd?: () => void) => {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
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
      // Still call onEnd so app doesn't get stuck
      onEnd?.();
    };

    utteranceRef.current = utterance;
    setIsSpeaking(true);
    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("TTS speak failed:", err);
      setIsSpeaking(false);
      onEnd?.();
    }
  }, [startResumeTimer, stopResumeTimer]);

  const stop = useCallback(() => {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
    stopResumeTimer();
    setIsSpeaking(false);
  }, [stopResumeTimer]);

  // Cleanup
  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
      if (resumeTimerRef.current) clearInterval(resumeTimerRef.current);
    };
  }, []);

  return { speak, stop, isSpeaking, warmUp };
}