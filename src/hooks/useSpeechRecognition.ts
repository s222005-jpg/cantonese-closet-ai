import { useRef, useState, useCallback, useEffect } from "react";

export type RecognitionState = "idle" | "listening" | "error";

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export function useSpeechRecognition(onCommand: (transcript: string) => void) {
  const recognitionRef = useRef<typeof SpeechRecognition | null>(null);
  const [state, setState] = useState<RecognitionState>("idle");
  const activeRef = useRef(false);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setState("error");
      return;
    }
    if (activeRef.current) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-HK";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState("listening");
      activeRef.current = true;
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const results = event.results;
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result && result[0]) {
          const transcript = result[0].transcript.trim();
          if (transcript) onCommand(transcript);
        }
      }
    };

    recognition.onerror = (event: { error: string }) => {
      console.warn("Speech recognition error:", event.error);
      if (event.error !== "no-speech") {
        setState("error");
      }
    };

    recognition.onend = () => {
      activeRef.current = false;
      // Auto-restart if we didn't intentionally stop
      if (recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          setState("idle");
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setState("error");
    }
  }, [onCommand]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    activeRef.current = false;
    setState("idle");
  }, []);

  useEffect(() => {
    return () => stopListening();
  }, [stopListening]);

  return { state, startListening, stopListening, supported: !!SpeechRecognition };
}
