import { drawFrameOutline, drawQuadPath } from "../core/draw";
import { MediaSession } from "../core/media-session";
import { FingerFrameTracker } from "../core/tracker";
import { MAX_VIDEO_BYTES } from "../config";
import { createHandLandmarker, type HandLandmarkerLike } from "../services/mediapipe";
import { GeminiVideoGenerator } from "../services/gemini";
import type { Landmark, TrackerState } from "../types";

type VideoElements = {
  canvas: HTMLCanvasElement;
  original: HTMLVideoElement;
  styled: HTMLVideoElement;
};

type VideoCallbacks = {
  onStatus: (message: string, kind?: "normal" | "busy" | "ready" | "error") => void;
  onReady: (ready: boolean) => void;
  onTracking: (state: TrackerState) => void;
};

export class VideoWorkspace {
  private readonly context: CanvasRenderingContext2D;
  private readonly media: MediaSession;
  private readonly tracker = new FingerFrameTracker({ mirrorX: false });
  private readonly callbacks: VideoCallbacks;
  private readonly original: HTMLVideoElement;
  private readonly styled: HTMLVideoElement;
  private readonly canvas: HTMLCanvasElement;
  private landmarker: HandLandmarkerLike | null = null;
  private videoFile: File | null = null;
  private styledUrl: string | null = null;
  private haveAI = false;
  private placeholder = false;
  private animationFrame = 0;
  private lastVideoTime = -1;
  private abortController: AbortController | null = null;
  private generationToken = 0;
  private exporting = false;

  constructor(elements: VideoElements, callbacks: VideoCallbacks) {
    this.callbacks = callbacks;
    this.original = elements.original;
    this.styled = elements.styled;
    this.canvas = elements.canvas;
    this.context = elements.canvas.getContext("2d")!;
    this.media = new MediaSession(this.original, this.canvas, {
      maxWidth: 1280,
      onResize: ({ width, height }) => this.tracker.setViewport(width, height),
    });
    this.media.observe();
  }

  async loadFile(file: File): Promise<void> {
    if (!file.type.startsWith("video/")) throw new Error("Please choose a video file.");
    this.cancelGeneration();
    this.stopPlayback();
    this.revokeStyledUrl();
    this.videoFile = file;
    this.haveAI = false;
    this.placeholder = false;
    this.callbacks.onReady(false);
    await this.media.useFile(file);
    this.callbacks.onStatus(
      `Loaded ${file.name} (${this.original.videoWidth}×${this.original.videoHeight}, ${this.original.duration.toFixed(1)}s).`,
      "ready",
    );
    this.drawPoster();
    if (!this.landmarker) {
      this.landmarker = await createHandLandmarker((message) =>
        this.callbacks.onStatus(message, "busy"),
      );
      this.callbacks.onStatus(
        "Video ready. Generate an AI version or use the placeholder.",
        "ready",
      );
    }
  }

  usePlaceholder(): void {
    if (!this.videoFile) {
      this.callbacks.onStatus("Choose a video first.", "normal");
      return;
    }
    this.placeholder = true;
    this.haveAI = false;
    this.callbacks.onReady(true);
    this.callbacks.onStatus("Placeholder enabled. You can preview or export.", "ready");
  }

  async generate(key: string, prompt: string): Promise<void> {
    if (!this.videoFile) {
      this.callbacks.onStatus("Choose a video first.", "normal");
      return;
    }
    if (this.videoFile.size > MAX_VIDEO_BYTES) {
      this.callbacks.onStatus("The video is over 15MB. Compress it before uploading.", "error");
      return;
    }
    this.abortController?.abort();
    const generationToken = ++this.generationToken;
    const controller = new AbortController();
    const input = this.videoFile;
    this.abortController = controller;
    this.callbacks.onStatus("Submitting the Gemini generation task…", "busy");
    try {
      const generator = new GeminiVideoGenerator(
        () => key,
        (message) => this.callbacks.onStatus(message, "busy"),
      );
      const blob = await generator.generate(input, prompt, controller.signal);
      if (generationToken !== this.generationToken) return;
      this.revokeStyledUrl();
      this.styledUrl = URL.createObjectURL(blob);
      this.styled.src = this.styledUrl;
      await this.waitForStyledMetadata();
      if (generationToken !== this.generationToken) return;
      this.haveAI = true;
      this.placeholder = false;
      this.callbacks.onReady(true);
      this.callbacks.onStatus("AI video ready. You can preview or export.", "ready");
    } catch (error) {
      if (generationToken !== this.generationToken) return;
      if (error instanceof DOMException && error.name === "AbortError") {
        this.callbacks.onStatus("AI generation cancelled.", "normal");
      } else {
        this.callbacks.onStatus(
          error instanceof Error ? error.message : "AI generation failed.",
          "error",
        );
      }
    } finally {
      if (generationToken === this.generationToken) this.abortController = null;
    }
  }

  cancelGeneration(): void {
    this.generationToken += 1;
    this.abortController?.abort();
    this.abortController = null;
  }

  async preview(): Promise<void> {
    if (!this.videoFile || (!this.haveAI && !this.placeholder)) {
      this.callbacks.onStatus("Generate an AI video or enable the placeholder first.", "normal");
      return;
    }
    this.stopPlayback();
    this.tracker.reset();
    this.lastVideoTime = -1;
    this.original.currentTime = 0;
    if (this.haveAI) this.styled.currentTime = 0;
    await this.original.play();
    if (this.haveAI) await this.styled.play().catch(() => undefined);
    this.animationFrame = requestAnimationFrame(this.render);
    this.callbacks.onStatus("Previewing…", "busy");
  }

  async step(time: number): Promise<TrackerState> {
    if (!this.videoFile || !this.landmarker) {
      throw new Error("Choose a video and wait for the hand tracker before stepping frames.");
    }
    this.stopPlayback();
    const targetTime = Math.min(
      Math.max(0, time),
      Number.isFinite(this.original.duration) ? Math.max(0, this.original.duration - 0.001) : time,
    );
    if (Math.abs(this.original.currentTime - targetTime) > 0.001) {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          this.original.removeEventListener("seeked", onSeeked);
          this.original.removeEventListener("error", onError);
        };
        const onSeeked = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error("Could not seek the source video."));
        };
        this.original.addEventListener("seeked", onSeeked, { once: true });
        this.original.addEventListener("error", onError, { once: true });
        this.original.currentTime = targetTime;
      });
    }
    return this.drawCurrentFrame();
  }

  async export(): Promise<void> {
    if (this.exporting) return;
    if (!this.videoFile || (!this.haveAI && !this.placeholder)) {
      this.callbacks.onStatus("Generate an AI video or enable the placeholder first.", "normal");
      return;
    }
    if (!window.MediaRecorder || !this.canvas.captureStream) {
      this.callbacks.onStatus(
        "This browser does not support Canvas video export. Use a modern version of Chrome, Safari, or Edge.",
        "error",
      );
      return;
    }
    this.exporting = true;
    this.callbacks.onStatus("Playing and recording the video for export…", "busy");
    const stream = this.canvas.captureStream(30);
    const mime =
      ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find(
        (value) => MediaRecorder.isTypeSupported(value),
      ) || "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    const finished = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    const onEnded = () => recorder.state !== "inactive" && recorder.stop();
    try {
      recorder.start();
      await this.preview();
      this.original.onended = onEnded;
      if (this.original.ended) onEnded();
      await finished;
      const extension = mime.startsWith("video/mp4") ? "mp4" : "webm";
      const blob = new Blob(chunks, { type: mime });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `finger-frame-studio.${extension}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      this.callbacks.onStatus(
        `Exported ${extension.toUpperCase()}. Browser Canvas export does not include the original audio; use the CLI when audio is required.`,
        "ready",
      );
    } catch (error) {
      if (recorder.state !== "inactive") recorder.stop();
      this.callbacks.onStatus(error instanceof Error ? error.message : "Export failed.", "error");
    } finally {
      this.original.onended = null;
      stream.getTracks().forEach((track) => track.stop());
      this.exporting = false;
    }
  }

  dispose(): void {
    this.cancelGeneration();
    this.stopPlayback();
    this.landmarker?.close?.();
    this.landmarker = null;
    this.revokeStyledUrl();
    this.media.dispose();
  }

  private readonly render = (): void => {
    if (this.original.paused || this.original.ended) return;
    this.drawCurrentFrame();
    this.animationFrame = requestAnimationFrame(this.render);
  };

  private drawCurrentFrame(): TrackerState {
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.context.drawImage(this.original, 0, 0, width, height);
    let landmarks: Landmark[][] = [];
    if (this.landmarker && this.original.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.original.currentTime;
      landmarks = this.landmarker.detectForVideo(this.original, performance.now()).landmarks || [];
    }
    const state = this.tracker.update(landmarks, performance.now());
    this.callbacks.onTracking(state);
    if (this.haveAI && Math.abs(this.styled.currentTime - this.original.currentTime) > 0.1) {
      this.styled.currentTime = this.original.currentTime;
    }
    if (state.quad && state.active) {
      this.context.save();
      this.context.globalAlpha = state.presence;
      drawQuadPath(this.context, state.quad);
      this.context.clip();
      if (this.haveAI) {
        this.context.drawImage(this.styled, 0, 0, width, height);
      } else {
        this.context.filter = "hue-rotate(140deg) saturate(1.7) contrast(1.15)";
        this.context.drawImage(this.original, 0, 0, width, height);
        this.context.filter = "none";
      }
      this.context.restore();
      drawFrameOutline(this.context, state.quad, state.presence, this.original.currentTime);
    }
    return state;
  }

  private drawPoster(): void {
    this.original.currentTime = 0;
    const draw = () => {
      this.context.drawImage(this.original, 0, 0, this.canvas.width, this.canvas.height);
      this.original.removeEventListener("seeked", draw);
    };
    this.original.addEventListener("seeked", draw, { once: true });
  }

  private stopPlayback(): void {
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.original.pause();
    this.styled.pause();
    this.original.onended = null;
  }

  private revokeStyledUrl(): void {
    if (this.styledUrl) URL.revokeObjectURL(this.styledUrl);
    this.styledUrl = null;
    this.styled.removeAttribute("src");
  }

  private async waitForStyledMetadata(): Promise<void> {
    if (this.styled.readyState >= HTMLMediaElement.HAVE_METADATA) return;
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("Could not read the video returned by Gemini."));
      };
      const cleanup = () => {
        this.styled.removeEventListener("loadedmetadata", onLoaded);
        this.styled.removeEventListener("error", onError);
      };
      this.styled.addEventListener("loadedmetadata", onLoaded, { once: true });
      this.styled.addEventListener("error", onError, { once: true });
    });
  }
}
