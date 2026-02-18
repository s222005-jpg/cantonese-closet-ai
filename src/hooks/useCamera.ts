import { useRef, useState, useCallback } from "react";

export type CameraState = "idle" | "requesting" | "active" | "error";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setCameraState("requesting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState("active");
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera error";
      setError(msg);
      setCameraState("error");
      return false;
    }
  }, []);

  const capturePhoto = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || cameraState !== "active") return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    // Return base64 without the data:image/... prefix for API
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  }, [cameraState]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraState("idle");
  }, []);

  return { videoRef, cameraState, error, startCamera, capturePhoto, stopCamera };
}
