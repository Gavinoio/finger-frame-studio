import type { FrameTracker, Landmark, Point, TrackerOptions, TrackerState } from "../types";

const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;

const SPREAD_ACQUIRE = 0.75;
const SPREAD_KEEP = 0.2;
const AREA_ACQUIRE = 0.005;
const AREA_KEEP = 0.0005;
const JUMP_FRACTION = 0.3;
const JUMP_CONFIRM_FRAMES = 2;
const ALPHA_MIN = 0.35;
const ALPHA_MAX = 0.85;
const ALPHA_SCALE = 0.05;
const PRESENCE_IN_RATE = 7.2;
const PRESENCE_OUT_RATE = 3;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function lerp(a: Point, b: Point, amount: number): Point {
  return { x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount };
}

function polygonArea(points: Point[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const next = points[(index + 1) % points.length];
    if (!point || !next) continue;
    area += point.x * next.y - next.x * point.y;
  }
  return Math.abs(area / 2);
}

function angleSorted(points: Point[]): Point[] {
  const center = points.reduce(
    (result, point) => ({
      x: result.x + point.x / points.length,
      y: result.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );
  return [...points].sort(
    (a, b) =>
      Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x),
  );
}

export class FingerFrameTracker implements FrameTracker {
  private readonly options: TrackerOptions;
  private width = 1;
  private height = 1;
  private corners: Point[] | null = null;
  private presence = 0;
  private frameActive = false;
  private lostFrames = 0;
  private jumpFrames = 0;
  private lastTimestamp = 0;

  constructor(options: Partial<TrackerOptions> = {}) {
    this.options = {
      mirrorX: false,
      maxLostFrames: 25,
      maxProcessingWidth: 1280,
      ...options,
    };
  }

  setViewport(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  update(landmarks: Landmark[][], timestamp: number): TrackerState {
    const dt = this.lastTimestamp
      ? clamp((timestamp - this.lastTimestamp) / 1000, 1 / 120, 0.1)
      : 1 / 60;
    this.lastTimestamp = timestamp;
    const target = landmarks.length === 2 ? this.computeQuad(landmarks) : null;

    if (target) {
      this.acceptTarget(target, dt);
    } else if (this.corners && this.lostFrames < this.options.maxLostFrames) {
      this.lostFrames += 1;
      this.presence = clamp(this.presence + PRESENCE_IN_RATE * dt, 0, 1);
    } else {
      this.presence = clamp(this.presence - PRESENCE_OUT_RATE * dt, 0, 1);
      if (this.presence === 0) {
        this.corners = null;
        this.frameActive = false;
        this.jumpFrames = 0;
      }
    }

    return {
      quad: this.corners ? this.corners.map((point) => ({ ...point })) : null,
      presence: this.presence,
      active: this.presence > 0.01,
      tracking: target !== null,
    };
  }

  reset(): void {
    this.corners = null;
    this.presence = 0;
    this.frameActive = false;
    this.lostFrames = 0;
    this.jumpFrames = 0;
    this.lastTimestamp = 0;
  }

  private acceptTarget(target: Point[], dt: number): void {
    if (!this.corners) {
      this.corners = target;
      this.frameActive = true;
      this.lostFrames = 0;
      this.jumpFrames = 0;
      this.presence = clamp(this.presence + PRESENCE_IN_RATE * dt, 0, 1);
      return;
    }

    const moved =
      target.reduce((sum, point, index) => {
        const current = this.corners?.[index];
        return sum + (current ? distance(point, current) : 0);
      }, 0) / 4;

    if (moved > this.width * JUMP_FRACTION && this.jumpFrames + 1 < JUMP_CONFIRM_FRAMES) {
      this.jumpFrames += 1;
      this.lostFrames += 1;
      if (this.lostFrames > this.options.maxLostFrames) {
        this.presence = clamp(this.presence - PRESENCE_OUT_RATE * dt, 0, 1);
      }
      return;
    }

    const amount = clamp(moved / (this.width * ALPHA_SCALE), ALPHA_MIN, ALPHA_MAX);
    this.corners = this.corners.map((point, index) => {
      const next = target[index];
      return next ? lerp(point, next, amount) : point;
    });
    this.frameActive = true;
    this.lostFrames = 0;
    this.jumpFrames = 0;
    this.presence = clamp(this.presence + PRESENCE_IN_RATE * dt, 0, 1);
  }

  private computeQuad(hands: Landmark[][]): Point[] | null {
    const info: Array<{ index: Point; thumb: Point; wristX: number }> = [];

    for (const landmarks of hands) {
      const wrist = landmarks[WRIST];
      const thumb = landmarks[THUMB_TIP];
      const index = landmarks[INDEX_TIP];
      const middle = landmarks[MIDDLE_MCP];
      if (!wrist || !thumb || !index || !middle) return null;

      const wristPoint = this.toPixel(wrist);
      const thumbPoint = this.toPixel(thumb);
      const indexPoint = this.toPixel(index);
      const middlePoint = this.toPixel(middle);
      const scale = distance(wristPoint, middlePoint) + 1;
      const needed = this.frameActive ? SPREAD_KEEP : SPREAD_ACQUIRE;
      if (distance(thumbPoint, indexPoint) < scale * needed) return null;

      info.push({ index: indexPoint, thumb: thumbPoint, wristX: wristPoint.x });
    }

    info.sort((a, b) => a.wristX - b.wristX);
    const left = info[0];
    const right = info[1];
    if (!left || !right) return null;

    const points = [left.index, right.index, right.thumb, left.thumb];
    const minimumArea = this.frameActive ? AREA_KEEP : AREA_ACQUIRE;
    if (polygonArea(angleSorted(points)) < this.width * this.height * minimumArea) return null;
    return points;
  }

  private toPixel(landmark: Landmark): Point {
    return {
      x: (this.options.mirrorX ? 1 - landmark.x : landmark.x) * this.width,
      y: landmark.y * this.height,
    };
  }
}

export { angleSorted, polygonArea };
