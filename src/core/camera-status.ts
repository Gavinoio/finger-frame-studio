const CAMERA_LIFECYCLE_PATTERN =
  /starting demo mode|preparing camera|loading (?:the )?hand[- ]tracking model|gpu unavailable|camera connected|demo mode started|camera permission|camera access|browser does not support camera|no camera|requested device not found|notfound|notallowed|denied|live mode failed/i;

export function isCameraLifecycleStatus(message: string): boolean {
  return CAMERA_LIFECYCLE_PATTERN.test(message);
}

export function formatCameraStatus(
  message: string,
  kind: string,
  demo: boolean,
  force = false,
): string | null {
  const isCameraStatus = force || isCameraLifecycleStatus(message);
  if (!isCameraStatus) return null;

  if (kind === "busy") return "Connecting camera";
  if (kind === "error") {
    if (/no camera|requested device not found|notfound/i.test(message)) {
      return "No camera detected";
    }
    if (/permission|notallowed|denied/i.test(message)) return "Camera permission denied";
    return "Camera unavailable";
  }
  if (kind === "live" || kind === "ready" || /camera connected|demo mode started/i.test(message)) {
    return demo ? "Demo preview" : "Camera connected";
  }
  return null;
}
