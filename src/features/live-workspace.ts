import { drawFrameOutline, drawMirrored } from "../core/draw";
import { makeDemoStream, fakeHands } from "../core/demo";
import { MediaSession } from "../core/media-session";
import { FingerFrameTracker } from "../core/tracker";
import { LUCY_EFFECTS } from "../config";
import { LocalEffectsRenderer } from "../effects/local-effects";
import { createHandLandmarker, type HandLandmarkerLike } from "../services/mediapipe";
import { LucyProvider } from "../services/lucy";
import type { Landmark, LocalEffectId, LucyEffectId, ProviderStatus, TrackerState } from "../types";

export type LiveEngine = "local" | "lucy";

type LiveElements = {
  canvas: HTMLCanvasElement;
  camera: HTMLVideoElement;
  lucy: HTMLVideoElement;
};

type LiveCallbacks = {
  onStatus: (message: string, kind?: "normal" | "busy" | "live" | "error") => void;
  onTracking: (state: TrackerState) => void;
};

export class LiveWorkspace {
  private readonly context: CanvasRenderingContext2D;
  private readonly media: MediaSession;
  private readonly tracker = new FingerFrameTracker({ mirrorX: true });
  private readonly effects: LocalEffectsRenderer;
  private readonly demo: boolean;
  private readonly callbacks: LiveCallbacks;
  private landmarker: HandLandmarkerLike | null = null;
  private lucyProvider: LucyProvider | null = null;
  private cameraStream: MediaStream | null = null;
  private animationFrame = 0;
  private lastVideoTime = -1;
  private running = false;
  private engine: LiveEngine = "local";
  private localEffect: LocalEffectId = "vangogh";
  private lucyEffect: LucyEffectId = "movie3d";
  private customPrompt = "";
  private getDecartKey: () => string = () => "";
  private fps = 30;
  private fpsAt = performance.now();
  private framesAt = 0;
  private connectToken = 0;
  private lifecycleToken = 0;
  private allowLucyReconnect = false;
  private remoteLucyStream: MediaStream | null = null;

  constructor(elements: LiveElements, callbacks: LiveCallbacks, demo = false) {
    this.callbacks = callbacks;
    this.demo = demo;
    this.context = elements.canvas.getContext("2d")!;
    this.media = new MediaSession(elements.camera, elements.canvas, {
      maxWidth: 1280,
      onResize: ({ width, height }) => this.tracker.setViewport(width, height),
    });
    this.effects = new LocalEffectsRenderer();
    this.camera = elements.camera;
    this.lucy = elements.lucy;
    this.canvas = elements.canvas;
    this.media.observe();
  }

  private readonly camera: HTMLVideoElement;
  private readonly lucy: HTMLVideoElement;
  private readonly canvas: HTMLCanvasElement;

  configureKey(getKey: () => string): void {
    this.getDecartKey = getKey;
  }

  async start(): Promise<void> {
    if (this.running) return;
    const lifecycleToken = ++this.lifecycleToken;
    this.running = true;
    let pendingLandmarker: HandLandmarkerLike | null = null;
    let pendingStream: MediaStream | null = null;
    const isCurrent = () => this.running && lifecycleToken === this.lifecycleToken;
    try {
      this.callbacks.onStatus(this.demo ? "Starting demo mode…" : "Preparing camera…", "busy");
      if (!this.demo) {
        pendingLandmarker = await createHandLandmarker((message) =>
          this.callbacks.onStatus(message, "busy"),
        );
        if (!isCurrent()) return;
        this.landmarker = pendingLandmarker;
        pendingLandmarker = null;
      }

      if (this.demo) {
        pendingStream = makeDemoStream();
      } else {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("This browser does not support camera access.");
        }
        pendingStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
            facingMode: "user",
          },
          audio: false,
        });
      }
      if (!isCurrent()) return;
      await this.media.useStream(pendingStream);
      if (!isCurrent()) return;
      this.cameraStream = pendingStream;
      pendingStream = null;
      this.callbacks.onStatus(
        this.demo ? "Demo mode started" : "Camera connected. Raise both hands to make an L.",
        "normal",
      );
      this.animationFrame = requestAnimationFrame(this.render);
    } catch (error) {
      if (lifecycleToken !== this.lifecycleToken) return;
      this.running = false;
      this.landmarker?.close?.();
      this.landmarker = null;
      this.media.stop();
      this.cameraStream = null;
      const message =
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser settings and try again."
          : error instanceof DOMException && error.name === "NotFoundError"
            ? "No camera detected"
            : error instanceof Error
              ? error.message
              : "Live mode failed to start.";
      this.callbacks.onStatus(message, "error");
      throw error;
    } finally {
      pendingLandmarker?.close?.();
      pendingStream?.getTracks().forEach((track) => track.stop());
    }
  }

  async stop(): Promise<void> {
    this.lifecycleToken += 1;
    this.running = false;
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.tracker.reset();
    this.lastVideoTime = -1;
    await this.disconnectLucy();
    this.landmarker?.close?.();
    this.landmarker = null;
    this.media.stop();
    this.cameraStream = null;
  }

  dispose(): void {
    void this.stop();
    this.effects.dispose();
    this.media.dispose();
  }

  setEngine(engine: LiveEngine): void {
    this.engine = engine;
    if (engine === "local") void this.disconnectLucy();
  }

  setLocalEffect(effect: LocalEffectId): void {
    this.localEffect = effect;
  }

  setLucyEffect(effect: LucyEffectId): void {
    this.lucyEffect = effect;
    void this.updateLucyPrompt();
  }

  setCustomPrompt(prompt: string): void {
    this.customPrompt = prompt;
    void this.updateLucyPrompt();
  }

  async connectLucy(): Promise<void> {
    if (!this.cameraStream || this.demo) {
      this.callbacks.onStatus("Demo mode does not connect to Lucy AI.", "normal");
      return;
    }
    if (!this.getDecartKey().trim()) {
      this.callbacks.onStatus(
        "Enter a Decart API key in Settings first, or continue with the local fallback.",
        "normal",
      );
      return;
    }
    this.engine = "lucy";
    this.allowLucyReconnect = true;
    const token = ++this.connectToken;
    this.remoteLucyStream = null;
    this.lucy.srcObject = null;
    this.ensureLucyProvider();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (token !== this.connectToken) return;
      try {
        if (attempt > 0) this.callbacks.onStatus(`Reconnecting Lucy (${attempt + 1}/3)…`, "busy");
        await this.lucyProvider?.connect();
        if (token === this.connectToken) {
          await this.updateLucyPrompt();
          return;
        }
      } catch {
        if (attempt < 2)
          await new Promise((resolve) => window.setTimeout(resolve, 900 * (attempt + 1)));
      }
    }
    this.callbacks.onStatus(
      "Lucy connection failed. Switched to the local color fallback.",
      "error",
    );
  }

  async disconnectLucy(): Promise<void> {
    this.allowLucyReconnect = false;
    this.connectToken += 1;
    this.remoteLucyStream = null;
    this.lucy.srcObject = null;
    await this.lucyProvider?.disconnect();
  }

  getEngine(): LiveEngine {
    return this.engine;
  }

  private ensureLucyProvider(): void {
    if (this.lucyProvider) return;
    this.lucyProvider = new LucyProvider(
      () => this.getDecartKey(),
      () => this.cameraStream,
      (stream) => {
        this.remoteLucyStream = stream;
        this.lucy.srcObject = stream;
        void this.lucy.play();
        stream.addEventListener(
          "inactive",
          () => {
            if (this.remoteLucyStream !== stream) return;
            this.remoteLucyStream = null;
            if (this.running && this.engine === "lucy" && this.allowLucyReconnect) {
              void this.connectLucy();
            }
          },
          { once: true },
        );
      },
      (status, message) => this.handleLucyStatus(status, message),
    );
  }

  private handleLucyStatus(status: ProviderStatus, message: string): void {
    const kind =
      status === "live"
        ? "live"
        : status === "error"
          ? "error"
          : status === "connecting"
            ? "busy"
            : "normal";
    this.callbacks.onStatus(message, kind);
  }

  private async updateLucyPrompt(): Promise<void> {
    if (!this.lucyProvider || this.engine !== "lucy") return;
    const selected = LUCY_EFFECTS.find((effect) => effect.id === this.lucyEffect);
    const prompt =
      selected?.prompt ||
      this.customPrompt.trim() ||
      "Change the style of the video to a 3D animated movie.";
    await this.lucyProvider.updatePrompt(prompt);
  }

  private readonly render = (): void => {
    if (!this.running) return;
    const width = this.canvas.width;
    const height = this.canvas.height;
    if (width && height && this.camera.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.context.clearRect(0, 0, width, height);
      drawMirrored(this.context, this.camera, width, height);
      const timestamp = performance.now();
      let landmarks: Landmark[][] = [];
      if (this.demo) {
        landmarks = fakeHands(timestamp / 1000);
      } else if (this.landmarker && this.camera.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = this.camera.currentTime;
        landmarks = this.landmarker.detectForVideo(this.camera, timestamp).landmarks || [];
      }
      const trackerState = this.tracker.update(landmarks, timestamp);
      this.callbacks.onTracking(trackerState);
      if (trackerState.quad && trackerState.active) {
        if (this.engine === "local") {
          const quality = this.fps < 24 ? { scale: 0.65 } : { scale: 1 };
          this.effects.render(
            this.context,
            this.camera,
            trackerState.quad,
            this.localEffect,
            trackerState.presence,
            timestamp / 1000,
            quality,
          );
        } else if (this.lucy.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          this.context.save();
          this.context.globalAlpha = trackerState.presence;
          this.context.beginPath();
          const first = trackerState.quad[0];
          if (first) {
            this.context.moveTo(first.x, first.y);
            trackerState.quad.slice(1).forEach((point) => this.context.lineTo(point.x, point.y));
            this.context.closePath();
            this.context.clip();
            drawMirrored(this.context, this.lucy, width, height);
          }
          this.context.restore();
        } else {
          this.context.save();
          this.context.globalAlpha = trackerState.presence;
          this.context.filter = "hue-rotate(140deg) saturate(1.6) contrast(1.1)";
          drawMirrored(this.context, this.camera, width, height);
          this.context.filter = "none";
          this.context.restore();
        }
        drawFrameOutline(this.context, trackerState.quad, trackerState.presence, timestamp / 1000);
      }
      this.updateFps();
    }
    this.animationFrame = requestAnimationFrame(this.render);
  };

  private updateFps(): void {
    this.framesAt += 1;
    const now = performance.now();
    if (now - this.fpsAt > 1000) {
      this.fps = (this.framesAt * 1000) / (now - this.fpsAt);
      this.framesAt = 0;
      this.fpsAt = now;
    }
  }
}
