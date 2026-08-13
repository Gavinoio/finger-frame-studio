export type AppMode = "live-local" | "live-lucy" | "video-ai";

export type Point = { x: number; y: number };

export type Landmark = { x: number; y: number; z?: number };

export type TrackerOptions = {
  mirrorX: boolean;
  maxLostFrames: number;
  maxProcessingWidth: number;
};

export type TrackerState = {
  quad: Point[] | null;
  presence: number;
  active: boolean;
  tracking: boolean;
};

export type ProviderStatus = "idle" | "connecting" | "live" | "reconnecting" | "error";

export interface FrameTracker {
  update(landmarks: Landmark[][], timestamp: number): TrackerState;
  reset(): void;
}

export interface AIProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  updatePrompt(prompt: string): Promise<void>;
  getStatus(): ProviderStatus;
}

export interface VideoGenerator {
  generate(input: File, prompt: string, signal: AbortSignal): Promise<Blob>;
}

export type LocalEffectId = "pixelate" | "blur" | "invert" | "noir" | "glitch" | "toon" | "vangogh";

export type LucyEffectId = "movie3d" | "anime" | "cyberpunk" | "watercolor" | "lego" | "custom";

export type VideoStyleId = "movie3d" | "anime" | "clay" | "watercolor" | "custom";
