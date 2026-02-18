import { useCallback } from "react";

export function useHaptics() {
  const vibrate = useCallback((pattern: number | number[]) => {
    if ("vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  return {
    onCameraActive: () => vibrate([100]),
    onPhotoTaken: () => vibrate([200, 100, 200]),
    onAnalysisStart: () => vibrate([50]),
    onSpeechStart: () => vibrate([150]),
  };
}
