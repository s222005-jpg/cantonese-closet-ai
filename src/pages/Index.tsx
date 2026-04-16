import { useEffect, useRef, useState, useCallback } from "react";
import { useCamera } from "@/hooks/useCamera";
import { useTTS } from "@/hooks/useTTS";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useHaptics } from "@/hooks/useHaptics";

type AppState =
  | "init"
  | "countdown"
  | "capturing"
  | "analyzing"
  | "result"
  | "listening"
  | "error";

interface OutfitAnalysis {
  上身: string;
  下身: string;
  顏色: string;
  風格: string;
  正式程度: string;
  配搭評分: string;
  建議: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const CANTONESE_NUMBERS = ["五", "四", "三", "二", "一"];

function analysisToSpeech(a: OutfitAnalysis): string {
  return `你而家著緊${a.上身}，同${a.下身}。主要顏色係${a.顏色}。整體風格${a.風格}，${a.正式程度}風格。配搭評分${a.配搭評分}。${a.建議}`;
}

export default function Index() {
  const { videoRef, cameraState, startCamera, capturePhoto } = useCamera();
  const { speak, stop: stopSpeech, isSpeaking } = useTTS();
  const haptics = useHaptics();

  const [appState, setAppState] = useState<AppState>("init");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [statusText, setStatusText] = useState("撳螢幕任何地方開始");
  const [analysis, setAnalysis] = useState<OutfitAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ttsRate, setTtsRate] = useState(1.0);
  const [lastResult, setLastResult] = useState<string>("");

  const hasShownPrivacy = useRef(false);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cameraStartedRef = useRef(false);

  // Refs so callbacks always see latest values
  const appStateRef = useRef<AppState>("init");
  const startFlowRef = useRef<() => void>(() => {});
  const handleFollowUpRef = useRef<(q: string) => void>(() => {});

  // Voice command handler — uses refs to avoid stale closures
  const handleVoiceCommand = useCallback(
    (transcript: string) => {
      console.log("Voice command:", transcript);

      // "開始" / "影相" triggers — works from any state where camera is ready
      if (
        transcript.includes("開始") ||
        transcript.includes("影相") ||
        transcript.includes("分析我嘅穿搭") ||
        transcript.includes("再試一次") ||
        transcript.includes("再試")
      ) {
        if (cameraStartedRef.current) {
          startFlowRef.current();
        }
        return;
      }

      if (transcript.includes("停止")) {
        stopSpeech();
        return;
      }
      if (transcript.includes("重複") && lastResult) {
        speak(lastResult, ttsRate);
        return;
      }
      if (transcript.includes("講慢啲")) {
        setTtsRate(0.7);
        speak(lastResult || "速度已調慢。", 0.7);
        return;
      }
      // Follow-up questions
      if (
        transcript.includes("見工") ||
        transcript.includes("婚禮") ||
        transcript.includes("鞋") ||
        transcript.includes("適唔適合") ||
        transcript.includes("應該")
      ) {
        handleFollowUpRef.current(transcript);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lastResult, ttsRate]
  );

  const { startListening, stopListening, supported: speechSupported } =
    useSpeechRecognition(handleVoiceCommand);

  const startFlow = useCallback(() => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    stopSpeech();
    setAppState("countdown");
    appStateRef.current = "countdown";
    setAnalysis(null);
    setErrorMsg(null);
    setStatusText("五秒後拍照");
    speak("五秒後拍照。");
    haptics.onCameraActive();

    let count = 5;
    setCountdown(count);
    countdownTimerRef.current = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(countdownTimerRef.current!);
        setCountdown(null);
        doCapture();
      } else {
        speak(CANTONESE_NUMBERS[5 - count] || String(count));
      }
    }, 1000);
  }, [speak, stopSpeech, haptics]);

  // Keep ref in sync
  useEffect(() => { startFlowRef.current = startFlow; }, [startFlow]);

  const doCapture = useCallback(async () => {
    setAppState("capturing");
    appStateRef.current = "capturing";
    setStatusText("正在拍照…");
    haptics.onPhotoTaken();

    const base64 = capturePhoto();
    console.log("Captured photo, base64 length:", base64?.length ?? 0);

    if (!base64) {
      setErrorMsg("無法拍攝照片，請再試一次。");
      setAppState("error");
      appStateRef.current = "error";
      speak("無法拍攝照片，請再試一次。");
      return;
    }

    setAppState("analyzing");
    appStateRef.current = "analyzing";
    setStatusText("分析緊…");
    haptics.onAnalysisStart();
    speak("分析緊，請稍候。");

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-outfit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ imageBase64: base64 }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "分析失敗");
      }

      const result: OutfitAnalysis = data.analysis;
      setAnalysis(result);
      setAppState("result");
      appStateRef.current = "result";
      setStatusText("分析完成");

      const speechText = analysisToSpeech(result);
      setLastResult(speechText);
      haptics.onSpeechStart();
      speak(speechText, ttsRate, () => {
        setAppState("listening");
        appStateRef.current = "listening";
        setStatusText("講「再試一次」重新分析，或者問問題");
        startListening();
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "分析失敗，請再試一次。";
      setErrorMsg(msg);
      setAppState("error");
      appStateRef.current = "error";
      speak("分析失敗，請再試一次。");
    }
  }, [capturePhoto, speak, haptics, ttsRate, startListening]);

  const handleFollowUp = useCallback(
    async (question: string) => {
      stopSpeech();
      setStatusText("搜尋答案緊…");
      speak("好，等我諗下。");

      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/followup-question`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ analysis, question }),
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          throw new Error(data.error || "處理失敗");
        }

        const answer: string = data.answer;
        setLastResult(answer);
        setStatusText("分析完成");
        haptics.onSpeechStart();
        speak(answer, ttsRate);
      } catch {
        speak("唔好意思，未能回答呢個問題，請再試一次。");
      }
    },
    [analysis, speak, stopSpeech, haptics, ttsRate]
  );

  // Keep ref in sync
  useEffect(() => { handleFollowUpRef.current = handleFollowUp; }, [handleFollowUp]);

  // User-gesture-driven start — required for camera access on mobile browsers
  const handleStart = useCallback(async () => {
    // If already in a flow (countdown, capturing, analyzing), ignore taps
    const current = appStateRef.current;
    if (current === "countdown" || current === "capturing" || current === "analyzing") {
      return;
    }

    // Warm up TTS on first user gesture (required by mobile browsers)
    if (!hasShownPrivacy.current) {
      // Silent utterance to unlock audio playback
      const warmup = new SpeechSynthesisUtterance("");
      warmup.volume = 0;
      window.speechSynthesis.speak(warmup);

      const seen = localStorage.getItem("vw_privacy_seen");
      if (!seen) {
        localStorage.setItem("vw_privacy_seen", "1");
        // Small delay so warmup utterance finishes first
        setTimeout(() => {
          speak("你嘅相片只會用作穿搭分析，系統唔會儲存或分享。");
        }, 100);
      }
      hasShownPrivacy.current = true;
    }

    // Only start camera if not already active
    if (!cameraStartedRef.current) {
      setStatusText("正在啟動相機…");
      const ok = await startCamera();
      if (!ok) {
        setAppState("error");
        appStateRef.current = "error";
        setStatusText("無法開啟相機");
        speak("無法開啟相機，請檢查權限。");
        return;
      }
      cameraStartedRef.current = true;
      startListening();
    }
    startFlow();
  }, [startCamera, startFlow, speak, startListening]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      stopListening();
    };
  }, [stopListening]);

  const stateColor: Record<AppState, string> = {
    init: "text-white",
    countdown: "glow-white text-white",
    capturing: "text-white",
    analyzing: "text-accent glow-gold",
    result: "text-white",
    listening: "text-[hsl(var(--listening))]",
    error: "text-destructive",
  };

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-between overflow-hidden cursor-pointer"
      style={{ background: "hsl(var(--deep-blue-dark))" }}
      aria-live="polite"
      aria-atomic="true"
      onClick={handleStart}
      role="button"
      aria-label="撳任何地方開始分析穿搭"
    >
      {/* Camera feed */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover opacity-40"
        playsInline
        muted
        autoPlay
        aria-hidden="true"
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-background/70" />

      {/* Top bar */}
      <div className="relative z-10 w-full h-12" />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 w-full max-w-lg">
        {/* Countdown */}
        {countdown !== null && (
          <div
            key={countdown}
            className="countdown-pulse text-[clamp(120px,30vw,180px)] font-black text-white glow-white leading-none mb-4"
            aria-label={`倒數 ${countdown}`}
          >
            {countdown}
          </div>
        )}

        {/* Status text */}
        <p
          className={`text-[clamp(28px,6vw,40px)] font-semibold text-center text-shadow-lg leading-tight mb-6 ${stateColor[appState] || "text-white"}`}
        >
          {statusText}
        </p>

        {/* Listening indicator */}
        {appState === "listening" && (
          <div className="flex items-center gap-3 mb-4">
            <div className="w-4 h-4 rounded-full bg-[hsl(var(--listening))] pulse-listening" />
            <span className="text-xl text-[hsl(var(--listening))]">正在聆聽…</span>
          </div>
        )}

        {/* Analyzing indicator */}
        {appState === "analyzing" && (
          <div className="flex items-center gap-2 mb-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full bg-accent"
                style={{ animation: `pulseListening 1.2s ${i * 0.3}s ease-in-out infinite` }}
              />
            ))}
          </div>
        )}

        {/* Analysis result cards */}
        {analysis && (appState === "result" || appState === "listening") && (
          <div className="w-full space-y-3 mt-2">
            <div className="rounded-xl border border-border/50 bg-card/60 p-4 backdrop-blur">
              <div className="grid grid-cols-2 gap-3 text-lg">
                <ResultItem label="上身" value={analysis.上身} />
                <ResultItem label="下身" value={analysis.下身} />
                <ResultItem label="顏色" value={analysis.顏色} />
                <ResultItem label="風格" value={analysis.風格} />
                <ResultItem label="正式程度" value={analysis.正式程度} />
                <ResultItem label="評分" value={analysis.配搭評分} highlight />
              </div>
              <div className="mt-3 pt-3 border-t border-border/30">
                <p className="text-sm text-muted-foreground mb-1">建議</p>
                <p className="text-base text-foreground leading-relaxed">{analysis.建議}</p>
              </div>
            </div>
          </div>
        )}

        {/* Init state — big start button */}
        {appState === "init" && (
          <button
            onClick={handleStart}
            className="mt-4 w-full max-w-xs py-6 rounded-2xl bg-accent text-accent-foreground text-2xl font-bold tracking-wide active:scale-95 transition-transform"
            aria-label="撳呢度開始分析穿搭"
          >
            開始分析穿搭
          </button>
        )}

        {/* Error state */}
        {appState === "error" && errorMsg && (
          <div className="rounded-xl bg-destructive/20 border border-destructive/50 p-5 text-center">
            <p className="text-destructive text-xl">{errorMsg}</p>
            <button
              onClick={handleStart}
              className="mt-4 py-3 px-8 rounded-xl bg-accent text-accent-foreground text-lg font-semibold active:scale-95 transition-transform"
            >
              再試一次
            </button>
          </div>
        )}
      </div>

      {/* Bottom area */}
      <div className="relative z-10 w-full px-6 pb-safe pb-8">
        {appState === "listening" && (
          <div className="rounded-xl bg-muted/40 backdrop-blur p-4">
            <button
              onClick={() => startFlow()}
              className="w-full py-4 mb-3 rounded-xl bg-accent text-accent-foreground text-lg font-semibold active:scale-95 transition-transform"
            >
              再影多張
            </button>
            <p className="text-muted-foreground text-base text-center mb-2">或者講：</p>
            <div className="flex flex-wrap justify-center gap-2">
              {["「開始」", "「重複」", "「講慢啲」", "「適唔適合見工？」", "「停止」"].map((cmd) => (
                <span key={cmd} className="text-sm text-foreground bg-secondary/60 rounded-full px-3 py-1">
                  {cmd}
                </span>
              ))}
            </div>
          </div>
        )}
        {!speechSupported && (
          <p className="text-center text-muted-foreground text-sm">
            此瀏覽器不支援語音識別，請使用 Chrome
          </p>
        )}
      </div>

      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="absolute top-16 right-4 z-20 flex items-center gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-1.5 rounded-full bg-accent"
              style={{
                height: `${12 + i * 6}px`,
                animation: `pulseListening 0.8s ${i * 0.15}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-base font-medium ${highlight ? "text-accent glow-gold" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
