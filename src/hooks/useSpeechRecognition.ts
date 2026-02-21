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
  const wantListeningRef = useRef(false);
  const processedIndexRef = useRef(0);
  const onCommandRef = useRef(onCommand);

  // Keep callback ref in sync to avoid stale closures
  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setState("error");
      return;
    }
    
    wantListeningRef.current = true;
    
    // Already running — skip
    if (activeRef.current && recognitionRef.current) return;

    processedIndexRef.current = 0;

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
      for (let i = processedIndexRef.current; i < results.length; i++) {
        const result = results[i];
        if (result && result[0]) {
          const transcript = result[0].transcript.trim();
          if (transcript) onCommandRef.current(transcript);
        }
      }
      processedIndexRef.current = results.length;
    };

    recognition.onerror = (event: { error: string }) => {
      console.warn("Speech recognition error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setState("error");
        wantListeningRef.current = false;
      }
      // For "no-speech" and "aborted", let onend handle restart
    };

    recognition.onend = () => {
      activeRef.current = false;
      processedIndexRef.current = 0;
      // Auto-restart if we still want to listen
      if (wantListeningRef.current) {
        try {
          recognition.start();
        } catch {
          setState("idle");
        }
      } else {
        setState("idle");
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setState("error");
    }
  }, []);

  const stopListening = useCallback(() => {
    wantListeningRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    activeRef.current = false;
    setState("idle");
  }, []);

  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  return { state, startListening, stopListening, supported: !!SpeechRecognition };
}
