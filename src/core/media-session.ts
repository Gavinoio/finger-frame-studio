export type MediaSessionOptions = {
  maxWidth?: number;
  onResize?: (size: { width: number; height: number }) => void;
};

export function getMediaSize(
  source: HTMLVideoElement,
  maxWidth = 1280,
): { width: number; height: number } {
  const width = source.videoWidth || 1280;
  const height = source.videoHeight || 720;
  const scale = Math.min(1, maxWidth / width);
  return {
    width: Math.max(2, Math.round(width * scale)),
    height: Math.max(2, Math.round(height * scale)),
  };
}

export function configureCanvas(
  canvas: HTMLCanvasElement,
  source: HTMLVideoElement,
  maxWidth = 1280,
): void {
  const size = getMediaSize(source, maxWidth);
  if (canvas.width !== size.width || canvas.height !== size.height) {
    canvas.width = size.width;
    canvas.height = size.height;
  }
  canvas.style.aspectRatio = `${size.width} / ${size.height}`;
}

export class MediaSession {
  private readonly source: HTMLVideoElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly maxWidth: number;
  private objectUrl: string | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private onResize?: MediaSessionOptions["onResize"];

  constructor(
    source: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    options: MediaSessionOptions = {},
  ) {
    this.source = source;
    this.canvas = canvas;
    this.maxWidth = options.maxWidth ?? 1280;
    this.onResize = options.onResize;
  }

  setResizeHandler(handler: MediaSessionOptions["onResize"]): void {
    this.onResize = handler;
  }

  async useCamera(constraints: MediaStreamConstraints): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser does not support camera access.");
    }
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    await this.useStream(stream);
    return stream;
  }

  async useStream(stream: MediaStream): Promise<void> {
    this.source.srcObject = stream;
    await this.waitForMetadata();
    await this.source.play();
    this.syncCanvas();
  }

  async useFile(file: File): Promise<void> {
    this.revokeObjectUrl();
    this.objectUrl = URL.createObjectURL(file);
    this.source.srcObject = null;
    this.source.src = this.objectUrl;
    await this.waitForMetadata();
    this.syncCanvas();
  }

  syncCanvas(): void {
    configureCanvas(this.canvas, this.source, this.maxWidth);
    this.onResize?.({ width: this.canvas.width, height: this.canvas.height });
  }

  observe(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.syncCanvas());
    this.resizeObserver.observe(this.canvas);
    this.source.addEventListener("resize", () => this.syncCanvas());
  }

  stop(): void {
    const source = this.source.srcObject;
    if (source instanceof MediaStream) {
      source.getTracks().forEach((track) => track.stop());
    }
    this.source.pause();
    this.source.srcObject = null;
    this.revokeObjectUrl();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  dispose(): void {
    this.stop();
  }

  private async waitForMetadata(): Promise<void> {
    if (this.source.readyState >= HTMLMediaElement.HAVE_METADATA) return;
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("Could not read video metadata. Try an MP4, WebM, or MOV file."));
      };
      const cleanup = () => {
        this.source.removeEventListener("loadedmetadata", onLoaded);
        this.source.removeEventListener("error", onError);
      };
      this.source.addEventListener("loadedmetadata", onLoaded, { once: true });
      this.source.addEventListener("error", onError, { once: true });
    });
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }
}
