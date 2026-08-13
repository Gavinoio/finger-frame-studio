import { describe, expect, it } from "vitest";
import { formatCameraStatus, isCameraLifecycleStatus } from "../src/core/camera-status";

describe("camera status localization", () => {
  it("recognizes the hand-tracking loading message used by both live modes", () => {
    expect(isCameraLifecycleStatus("Loading the hand-tracking model…")).toBe(true);
    expect(formatCameraStatus("Loading the hand-tracking model…", "busy", false)).toBe(
      "Connecting camera",
    );
  });

  it("uses the same connected and demo labels as local live", () => {
    expect(
      formatCameraStatus("Camera connected. Raise both hands to make an L.", "normal", false),
    ).toBe("Camera connected");
    expect(formatCameraStatus("Demo mode started", "normal", true)).toBe("Demo preview");
  });

  it("localizes common camera failures", () => {
    expect(formatCameraStatus("Camera permission was denied.", "error", false)).toBe(
      "Camera permission denied",
    );
    expect(formatCameraStatus("Requested device not found", "error", false)).toBe(
      "No camera detected",
    );
  });

  it("does not overwrite Lucy provider connection messages", () => {
    expect(isCameraLifecycleStatus("Connecting to Lucy…")).toBe(false);
    expect(formatCameraStatus("Connecting to Lucy…", "busy", false)).toBeNull();
  });
});
