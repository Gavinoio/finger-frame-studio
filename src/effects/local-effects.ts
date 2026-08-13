import { drawMirrored, drawQuadPath } from "../core/draw";
import type { LocalEffectId, Point } from "../types";

type RenderQuality = { scale: number };

const POSTER_LEVELS = 6;
const PAINT_SCALE = 4;
const posterLut = new Uint8Array(256);
for (let index = 0; index < 256; index += 1) {
  posterLut[index] = Math.round(
    (Math.round((index / 255) * (POSTER_LEVELS - 1)) / (POSTER_LEVELS - 1)) * 255,
  );
}

function bbox(quad: Point[], width: number, height: number) {
  const xs = quad.map((point) => point.x);
  const ys = quad.map((point) => point.y);
  return {
    x0: Math.max(0, Math.floor(Math.min(...xs))),
    y0: Math.max(0, Math.floor(Math.min(...ys))),
    x1: Math.min(width, Math.ceil(Math.max(...xs))),
    y1: Math.min(height, Math.ceil(Math.max(...ys))),
  };
}

export class LocalEffectsRenderer {
  private readonly pixelCanvas = document.createElement("canvas");
  private readonly toonCanvas = document.createElement("canvas");
  private readonly toonContext = this.toonCanvas.getContext("2d", { willReadFrequently: true });
  private readonly paintCanvas = document.createElement("canvas");
  private readonly paintContext = this.paintCanvas.getContext("2d", { willReadFrequently: true });
  private toonLum = new Float32Array();
  private paintData: Uint8ClampedArray | null = null;
  private paintAngle = new Float32Array();
  private paintMagnitude = new Float32Array();
  private paintLuminance = new Float32Array();
  private paintGradientX = new Float32Array();
  private paintGradientY = new Float32Array();
  private paintTempX = new Float32Array();
  private paintTempY = new Float32Array();

  render(
    context: CanvasRenderingContext2D,
    source: HTMLVideoElement,
    quad: Point[],
    effect: LocalEffectId,
    presence: number,
    time: number,
    quality: RenderQuality = { scale: 1 },
  ): void {
    const width = context.canvas.width;
    const height = context.canvas.height;
    context.save();
    drawQuadPath(context, quad);
    context.clip();
    context.globalAlpha = presence;

    switch (effect) {
      case "pixelate":
        this.drawPixelate(context, source, width, height, quality);
        break;
      case "blur":
        context.filter = "blur(14px) saturate(1.1)";
        drawMirrored(context, source, width, height);
        break;
      case "invert":
        context.filter = "invert(1)";
        drawMirrored(context, source, width, height);
        break;
      case "noir":
        context.filter = "grayscale(1) contrast(1.5) brightness(0.95)";
        drawMirrored(context, source, width, height);
        break;
      case "glitch":
        this.drawGlitch(context, source, width, height, time);
        break;
      case "toon":
        this.drawToon(context, source, width, height, quality);
        break;
      case "vangogh":
        this.drawPainterly(context, source, quad, width, height, time, quality);
        break;
    }

    context.filter = "none";
    context.globalAlpha = 1;
    context.restore();
  }

  dispose(): void {
    this.pixelCanvas.width = 0;
    this.pixelCanvas.height = 0;
    this.toonCanvas.width = 0;
    this.toonCanvas.height = 0;
    this.paintCanvas.width = 0;
    this.paintCanvas.height = 0;
  }

  private drawPixelate(
    context: CanvasRenderingContext2D,
    source: HTMLVideoElement,
    width: number,
    height: number,
    quality: RenderQuality,
  ): void {
    const factor = Math.max(16, Math.round(24 / quality.scale));
    const smallWidth = Math.max(2, Math.round(width / factor));
    const smallHeight = Math.max(2, Math.round(height / factor));
    if (this.pixelCanvas.width !== smallWidth || this.pixelCanvas.height !== smallHeight) {
      this.pixelCanvas.width = smallWidth;
      this.pixelCanvas.height = smallHeight;
    }
    const smallContext = this.pixelCanvas.getContext("2d");
    if (!smallContext) return;
    drawMirrored(smallContext, source, smallWidth, smallHeight);
    context.imageSmoothingEnabled = false;
    context.drawImage(this.pixelCanvas, 0, 0, smallWidth, smallHeight, 0, 0, width, height);
    context.imageSmoothingEnabled = true;
  }

  private drawGlitch(
    context: CanvasRenderingContext2D,
    source: HTMLVideoElement,
    width: number,
    height: number,
    time: number,
  ): void {
    context.filter = "saturate(1.6) contrast(1.1)";
    drawMirrored(context, source, width, height);
    context.globalAlpha = 0.32;
    context.filter = "hue-rotate(120deg)";
    context.save();
    context.translate(8 + Math.sin(time * 9) * 5, 0);
    drawMirrored(context, source, width, height);
    context.restore();
    context.filter = "hue-rotate(-120deg)";
    context.save();
    context.translate(-8 - Math.sin(time * 9) * 5, 0);
    drawMirrored(context, source, width, height);
    context.restore();
    context.filter = "none";
    context.globalAlpha = 1;
    for (let index = 0; index < 7; index += 1) {
      const seed = Math.sin(index * 127.1 + Math.floor(time * 12) * 311.7);
      const y = Math.floor((seed * 0.5 + 0.5) * height);
      const sliceHeight = 6 + Math.floor(Math.abs(seed) * 26);
      context.save();
      context.translate(seed * 34, 0);
      context.globalAlpha = 0.72;
      context.beginPath();
      context.rect(0, y, width, sliceHeight);
      context.clip();
      drawMirrored(context, source, width, height);
      context.restore();
    }
    context.fillStyle = "rgba(0,0,0,0.16)";
    for (let y = 0; y < height; y += 6) context.fillRect(0, y, width, 2);
  }

  private drawToon(
    context: CanvasRenderingContext2D,
    source: HTMLVideoElement,
    width: number,
    height: number,
    quality: RenderQuality,
  ): void {
    const toonWidth = Math.max(160, Math.round(320 * quality.scale));
    const toonHeight = Math.max(2, Math.round((toonWidth * height) / width));
    if (this.toonCanvas.width !== toonWidth || this.toonCanvas.height !== toonHeight) {
      this.toonCanvas.width = toonWidth;
      this.toonCanvas.height = toonHeight;
      this.toonLum = new Float32Array(toonWidth * toonHeight);
    }
    const toonContext = this.toonContext;
    if (!toonContext) return;
    toonContext.filter = "saturate(1.6) blur(0.6px) brightness(1.05)";
    drawMirrored(toonContext, source, toonWidth, toonHeight);
    toonContext.filter = "none";
    const image = toonContext.getImageData(0, 0, toonWidth, toonHeight);
    const pixels = image.data;
    for (let index = 0, pixel = 0; index < this.toonLum.length; index += 1, pixel += 4) {
      const red = pixels[pixel] ?? 0;
      const green = pixels[pixel + 1] ?? 0;
      const blue = pixels[pixel + 2] ?? 0;
      this.toonLum[index] = 0.299 * red + 0.587 * green + 0.114 * blue;
      pixels[pixel] = posterLut[red] ?? red;
      pixels[pixel + 1] = posterLut[green] ?? green;
      pixels[pixel + 2] = posterLut[blue] ?? blue;
    }
    for (let y = 1; y < toonHeight - 1; y += 1) {
      for (let x = 1; x < toonWidth - 1; x += 1) {
        const index = y * toonWidth + x;
        const gx =
          -(this.toonLum[index - toonWidth - 1] ?? 0) -
          2 * (this.toonLum[index - 1] ?? 0) -
          (this.toonLum[index + toonWidth - 1] ?? 0) +
          (this.toonLum[index - toonWidth + 1] ?? 0) +
          2 * (this.toonLum[index + 1] ?? 0) +
          (this.toonLum[index + toonWidth + 1] ?? 0);
        const gy =
          -(this.toonLum[index - toonWidth - 1] ?? 0) -
          2 * (this.toonLum[index - toonWidth] ?? 0) -
          (this.toonLum[index - toonWidth + 1] ?? 0) +
          (this.toonLum[index + toonWidth - 1] ?? 0) +
          2 * (this.toonLum[index + toonWidth] ?? 0) +
          (this.toonLum[index + toonWidth + 1] ?? 0);
        if (Math.abs(gx) + Math.abs(gy) > 90) {
          const pixel = index * 4;
          pixels[pixel] = Math.round((pixels[pixel] ?? 0) * 0.18);
          pixels[pixel + 1] = Math.round((pixels[pixel + 1] ?? 0) * 0.18);
          pixels[pixel + 2] = Math.round((pixels[pixel + 2] ?? 0) * 0.18);
        }
      }
    }
    toonContext.putImageData(image, 0, 0);
    context.drawImage(this.toonCanvas, 0, 0, toonWidth, toonHeight, 0, 0, width, height);
  }

  private drawPainterly(
    context: CanvasRenderingContext2D,
    source: HTMLVideoElement,
    quad: Point[],
    width: number,
    height: number,
    time: number,
    quality: RenderQuality,
  ): void {
    const box = bbox(quad, width, height);
    if (!this.buildPaintField(source, width, height, box)) return;

    context.filter = "blur(10px) saturate(1.7) brightness(0.92)";
    drawMirrored(context, source, width, height);
    context.filter = "none";
    context.lineCap = "round";
    context.lineJoin = "round";

    const x0 = Math.max(6, box.x0);
    const y0 = Math.max(6, box.y0);
    const x1 = Math.min(width - 6, box.x1);
    const y1 = Math.min(height - 6, box.y1);
    const bigStep = Math.max(12, Math.round(14 / quality.scale));
    for (let y = y0; y < y1; y += bigStep) {
      for (let x = x0; x < x1; x += bigStep) {
        const jitter = this.hash(x, y);
        const px = x + (jitter - 0.5) * bigStep;
        const py = y + (this.hash(y, x) - 0.5) * bigStep;
        context.strokeStyle = this.paintColor(px, py, jitter);
        context.lineWidth = 8 + jitter * 4;
        context.globalAlpha = 0.85;
        this.paintStroke(context, px, py, 4, 6.5, time);
      }
    }

    const fineStep = Math.max(6, Math.round(6 / quality.scale));
    for (let y = y0; y < y1; y += fineStep) {
      for (let x = x0; x < x1; x += fineStep) {
        const jitter = this.hash(x + 7, y + 3);
        const px = x + (jitter - 0.5) * fineStep;
        const py = y + (this.hash(y + 5, x + 1) - 0.5) * fineStep;
        const onEdge = this.paintMagnitudeAt(px, py) > 20;
        if (!onEdge && jitter > 0.35) continue;
        context.strokeStyle = this.paintColor(px, py, this.hash(x, y + 11));
        context.lineWidth = onEdge ? 3 + jitter * 1.5 : 4 + jitter * 2;
        context.globalAlpha = onEdge ? 0.95 : 0.7;
        this.paintStroke(context, px, py, onEdge ? 2 : 3, 5, time);
      }
    }
    context.globalAlpha = 1;
    this.paintData = null;
  }

  private buildPaintField(
    source: HTMLVideoElement,
    width: number,
    height: number,
    box: ReturnType<typeof bbox>,
  ): boolean {
    const paintWidth = Math.ceil(width / PAINT_SCALE);
    const paintHeight = Math.ceil(height / PAINT_SCALE);
    if (this.paintCanvas.width !== paintWidth || this.paintCanvas.height !== paintHeight) {
      this.paintCanvas.width = paintWidth;
      this.paintCanvas.height = paintHeight;
    }
    const paintContext = this.paintContext;
    if (!paintContext) return false;
    paintContext.filter = "saturate(1.8) contrast(1.1)";
    drawMirrored(paintContext, source, paintWidth, paintHeight);
    paintContext.filter = "none";
    this.paintData = paintContext.getImageData(0, 0, paintWidth, paintHeight).data;

    const length = paintWidth * paintHeight;
    if (this.paintAngle.length !== length) {
      this.paintAngle = new Float32Array(length);
      this.paintMagnitude = new Float32Array(length);
      this.paintLuminance = new Float32Array(length);
      this.paintGradientX = new Float32Array(length);
      this.paintGradientY = new Float32Array(length);
      this.paintTempX = new Float32Array(length);
      this.paintTempY = new Float32Array(length);
    }

    const margin = 4;
    const x0 = Math.max(1, Math.floor(box.x0 / PAINT_SCALE) - margin);
    const x1 = Math.min(paintWidth - 2, Math.ceil(box.x1 / PAINT_SCALE) + margin);
    const y0 = Math.max(1, Math.floor(box.y0 / PAINT_SCALE) - margin);
    const y1 = Math.min(paintHeight - 2, Math.ceil(box.y1 / PAINT_SCALE) + margin);
    const data = this.paintData;
    for (let y = y0 - 1; y <= y1 + 1; y += 1) {
      for (let x = x0 - 1; x <= x1 + 1; x += 1) {
        const index = y * paintWidth + x;
        const pixel = index * 4;
        this.paintLuminance[index] =
          0.299 * (data[pixel] ?? 0) +
          0.587 * (data[pixel + 1] ?? 0) +
          0.114 * (data[pixel + 2] ?? 0);
      }
    }

    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const index = y * paintWidth + x;
        const lum = this.paintLuminance;
        this.paintGradientX[index] =
          -(lum[index - paintWidth - 1] ?? 0) -
          2 * (lum[index - 1] ?? 0) -
          (lum[index + paintWidth - 1] ?? 0) +
          (lum[index - paintWidth + 1] ?? 0) +
          2 * (lum[index + 1] ?? 0) +
          (lum[index + paintWidth + 1] ?? 0);
        this.paintGradientY[index] =
          -(lum[index - paintWidth - 1] ?? 0) -
          2 * (lum[index - paintWidth] ?? 0) -
          (lum[index - paintWidth + 1] ?? 0) +
          (lum[index + paintWidth - 1] ?? 0) +
          2 * (lum[index + paintWidth] ?? 0) +
          (lum[index + paintWidth + 1] ?? 0);
      }
    }

    const radius = 2;
    for (let y = y0; y <= y1; y += 1) {
      const row = y * paintWidth;
      for (let x = x0; x <= x1; x += 1) {
        let sumX = 0;
        let sumY = 0;
        let count = 0;
        for (let offset = -radius; offset <= radius; offset += 1) {
          const sampleX = x + offset;
          if (sampleX < x0 || sampleX > x1) continue;
          sumX += this.paintGradientX[row + sampleX] ?? 0;
          sumY += this.paintGradientY[row + sampleX] ?? 0;
          count += 1;
        }
        this.paintTempX[row + x] = sumX / count;
        this.paintTempY[row + x] = sumY / count;
      }
    }
    for (let x = x0; x <= x1; x += 1) {
      for (let y = y0; y <= y1; y += 1) {
        let sumX = 0;
        let sumY = 0;
        let count = 0;
        for (let offset = -radius; offset <= radius; offset += 1) {
          const sampleY = y + offset;
          if (sampleY < y0 || sampleY > y1) continue;
          sumX += this.paintTempX[sampleY * paintWidth + x] ?? 0;
          sumY += this.paintTempY[sampleY * paintWidth + x] ?? 0;
          count += 1;
        }
        const index = y * paintWidth + x;
        const gradientX = sumX / count;
        const gradientY = sumY / count;
        this.paintMagnitude[index] = Math.hypot(gradientX, gradientY);
        this.paintAngle[index] = Math.atan2(gradientY, gradientX) + Math.PI / 2;
      }
    }
    return true;
  }

  private paintFieldAngle(x: number, y: number, time: number): number {
    const sampleX = Math.min(this.paintCanvas.width - 1, Math.max(0, Math.round(x / PAINT_SCALE)));
    const sampleY = Math.min(this.paintCanvas.height - 1, Math.max(0, Math.round(y / PAINT_SCALE)));
    const index = sampleY * this.paintCanvas.width + sampleX;
    if ((this.paintMagnitude[index] ?? 0) > 14) return this.paintAngle[index] ?? 0;
    return Math.sin(x * 0.011 + time * 0.35) * 1.7 + Math.cos(y * 0.013 - time * 0.28) * 1.7;
  }

  private paintStroke(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    segments: number,
    segmentLength: number,
    time: number,
  ): void {
    context.beginPath();
    context.moveTo(x, y);
    let angle = this.paintFieldAngle(x, y, time);
    let currentX = x;
    let currentY = y;
    for (let segment = 0; segment < segments; segment += 1) {
      const nextAngle = this.paintFieldAngle(currentX, currentY, time);
      angle = Math.cos(nextAngle - angle) < 0 ? nextAngle + Math.PI : nextAngle;
      currentX += Math.cos(angle) * segmentLength;
      currentY += Math.sin(angle) * segmentLength;
      context.lineTo(currentX, currentY);
    }
    context.stroke();
  }

  private paintColor(x: number, y: number, jitter: number): string {
    if (!this.paintData || this.paintCanvas.width === 0 || this.paintCanvas.height === 0) {
      return "rgb(80,120,180)";
    }
    const sampleX = Math.min(this.paintCanvas.width - 1, Math.max(0, Math.round(x / PAINT_SCALE)));
    const sampleY = Math.min(this.paintCanvas.height - 1, Math.max(0, Math.round(y / PAINT_SCALE)));
    const pixel = (sampleY * this.paintCanvas.width + sampleX) * 4;
    const value = 1 + (jitter - 0.5) * 0.3;
    const red = Math.min(255, (this.paintData[pixel] ?? 80) * value);
    const green = Math.min(255, (this.paintData[pixel + 1] ?? 120) * value);
    const blue = Math.min(255, (this.paintData[pixel + 2] ?? 180) * (1 + (jitter - 0.5) * 0.22));
    return `rgb(${red | 0},${green | 0},${blue | 0})`;
  }

  private paintMagnitudeAt(x: number, y: number): number {
    const sampleX = Math.min(this.paintCanvas.width - 1, Math.max(0, Math.round(x / PAINT_SCALE)));
    const sampleY = Math.min(this.paintCanvas.height - 1, Math.max(0, Math.round(y / PAINT_SCALE)));
    return this.paintMagnitude[sampleY * this.paintCanvas.width + sampleX] ?? 0;
  }

  private hash(x: number, y: number): number {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return value - Math.floor(value);
  }
}
