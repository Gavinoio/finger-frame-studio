import { MEDIAPIPE_MODEL_URL, MEDIAPIPE_VERSION, MEDIAPIPE_WASM_URL } from "../config";
import type { Landmark } from "../types";

export type HandLandmarkerLike = {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): { landmarks?: Landmark[][] };
  close?: () => void;
};

type MediaPipeModule = {
  HandLandmarker: {
    createFromOptions: (
      fileset: unknown,
      options: Record<string, unknown>,
    ) => Promise<HandLandmarkerLike>;
  };
  FilesetResolver: { forVisionTasks: (url: string) => Promise<unknown> };
};

export async function createHandLandmarker(
  onStatus?: (message: string) => void,
): Promise<HandLandmarkerLike> {
  onStatus?.("Loading the hand-tracking model…");
  const moduleUrl = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
  const module = (await import(/* @vite-ignore */ moduleUrl)) as MediaPipeModule;
  const fileset = await module.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);

  try {
    return await module.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MEDIAPIPE_MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.3,
      minHandPresenceConfidence: 0.3,
      minTrackingConfidence: 0.3,
    });
  } catch {
    onStatus?.("GPU unavailable. Switching to compatibility mode…");
    return module.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MEDIAPIPE_MODEL_URL, delegate: "CPU" },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.3,
      minHandPresenceConfidence: 0.3,
      minTrackingConfidence: 0.3,
    });
  }
}
