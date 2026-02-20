import { useRef, useState, useCallback } from "react";

export type CameraState = "idle" | "requesting" | "active" | "error";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const cameraStateRef = useRef<CameraState>("idle");
  const [error, setError] = useState<string | null>(null);

  const updateCameraState = useCallback((state: CameraState) => {
    cameraStateRef.current = state;
    setCameraState(state);
  }, []);

  const startCamera = useCallback(async () => {
    updateCameraState("requesting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video metadata to load so dimensions are available
        await new Promise<void>((resolve) => {
          const video = videoRef.current!;
          if (video.readyState >= 2) {
            resolve();
          } else {
            video.onloadeddata = () => resolve();
          }
        });
        await videoRef.current.play();
      }
      updateCameraState("active");
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera error";
      setError(msg);
      updateCameraState("error");
      return false;
    }
  }, [updateCameraState]);

  const capturePhoto = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || cameraStateRef.current !== "active") {
      console.log("capturePhoto: not ready", { video: !!video, state: cameraStateRef.current });
      return null;
    }
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log("capturePhoto: video dimensions not ready", video.videoWidth, video.videoHeight);
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    updateCameraState("idle");
  }, [updateCameraState]);

  return { videoRef, cameraState, error, startCamera, capturePhoto, stopCamera };
}
