import { describe, expect, it } from "vitest";
import { FingerFrameTracker } from "../src/core/tracker";
import type { Landmark } from "../src/types";

function hand(indexX: number, thumbX: number, folded = false): Landmark[] {
  const landmarks: Landmark[] = Array.from({ length: 21 }, () => ({ x: indexX, y: 0.45 }));
  landmarks[0] = { x: indexX, y: 0.6 };
  landmarks[4] = { x: folded ? indexX + 0.01 : thumbX, y: 0.5 };
  landmarks[8] = { x: indexX, y: folded ? 0.49 : 0.2 };
  landmarks[9] = { x: indexX, y: 0.4 };
  return landmarks;
}

describe("FingerFrameTracker", () => {
  it("detects two open L hands", () => {
    const tracker = new FingerFrameTracker({ mirrorX: false });
    tracker.setViewport(1000, 600);
    const state = tracker.update([hand(0.25, 0.12), hand(0.75, 0.88)], 1000);
    expect(state.tracking).toBe(true);
    expect(state.quad).toHaveLength(4);
    expect(state.presence).toBeGreaterThan(0);
  });

  it("rejects one hand and folded fingers", () => {
    const tracker = new FingerFrameTracker();
    tracker.setViewport(1000, 600);
    expect(tracker.update([hand(0.25, 0.12)], 1000).tracking).toBe(false);
    expect(tracker.update([hand(0.25, 0.25, true), hand(0.75, 0.75, true)], 1100).tracking).toBe(
      false,
    );
  });

  it("supports mirrored coordinates", () => {
    const tracker = new FingerFrameTracker({ mirrorX: true });
    tracker.setViewport(1000, 600);
    const state = tracker.update([hand(0.25, 0.12), hand(0.75, 0.88)], 1000);
    expect(state.quad?.[0]?.x).toBeCloseTo(250);
  });

  it("holds briefly through a dropout and eventually fades", () => {
    const tracker = new FingerFrameTracker({ maxLostFrames: 2 });
    tracker.setViewport(1000, 600);
    const first = tracker.update([hand(0.25, 0.12), hand(0.75, 0.88)], 1000);
    const held = tracker.update([], 1016);
    expect(held.quad).not.toBeNull();
    tracker.update([], 1020);
    tracker.update([], 1040);
    tracker.update([], 1060);
    expect(first.quad).not.toBeNull();
    expect(tracker.update([], 1080).presence).toBeLessThanOrEqual(held.presence);
  });
});
