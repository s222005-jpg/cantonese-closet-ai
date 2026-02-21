import { useRef, useCallback, useState, useEffect } from "react";

export function useTTS() {
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

  const getVoice = useCallback(() => {
    const voices = voicesRef.current.length > 0
      ? voicesRef.current
      : window.speechSynthesis.getVoices();
    return voices.find(
      (v) => v.lang === "zh-HK" || v.lang === "zh-TW" || v.lang.startsWith("zh")
    ) || null;
  }, []);

  // Must be called during user gesture to unlock TTS on iOS/mobile
  const warmUp = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    try {
      // Speak a space character (not empty string — iOS ignores empty)
      // with volume 0 so user doesn't hear anything
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0.01; // near-silent
      u.lang = "zh-HK";
      const voice = getVoice();
      if (voice) u.voice = voice;
      window.speechSynthesis.speak(u);
      // Don't cancel — let it finish naturally so the queue stays unlocked
    } catch {
      // ignore
    }
  }, [getVoice]);

  const speak = useCallback((text: string, rate = 1.0, onEnd?: () => void) => {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
    stopResumeTimer();

    // Small delay after cancel to let the engine reset
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-HK";
      utterance.rate = rate;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voice = getVoice();
      if (voice) utterance.voice = voice;

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

      setIsSpeaking(true);
      try {
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("TTS speak failed:", err);
        setIsSpeaking(false);
        onEnd?.();
      }
    }, 50);
  }, [startResumeTimer, stopResumeTimer, getVoice]);

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