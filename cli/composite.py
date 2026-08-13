#!/usr/bin/env python3
"""Composite a stylized video inside the tracked finger frame."""

from __future__ import annotations

import argparse
import math
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
WRIST, THUMB_TIP, INDEX_TIP, MIDDLE_MCP = 0, 4, 8, 9


def require_tool(name: str) -> None:
    if shutil.which(name) is None:
        raise SystemExit(f"Required executable not found on PATH: {name}")


def distance(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def polygon_area(points: list[tuple[float, float]]) -> float:
    return abs(sum(points[i][0] * points[(i + 1) % len(points)][1] - points[(i + 1) % len(points)][0] * points[i][1] for i in range(len(points))) / 2)


class FrameTracker:
    def __init__(self, width: int, height: int) -> None:
        self.width, self.height = width, height
        self.corners: list[tuple[float, float]] | None = None
        self.presence = 0.0
        self.active = False
        self.lost = 0
        self.jumps = 0

    def update(self, hands: list[list[object]]) -> list[tuple[float, float]] | None:
        target = self.compute(hands)
        if target is None:
            if self.corners is not None and self.lost < 25:
                self.lost += 1
                self.presence = min(1.0, self.presence + 0.12)
            else:
                self.presence = max(0.0, self.presence - 0.05)
                if self.presence == 0:
                    self.corners = None
                    self.active = False
            return self.corners if self.presence > 0.01 else None

        if self.corners is None:
            self.corners = target
            self.presence = min(1.0, self.presence + 0.12)
            self.active = True
            self.lost = 0
            return self.corners

        moved = sum(distance(a, b) for a, b in zip(target, self.corners)) / 4
        if moved > self.width * 0.3 and self.jumps + 1 < 2:
            self.jumps += 1
            self.lost += 1
            return self.corners

        amount = min(0.85, max(0.35, moved / (self.width * 0.05)))
        self.corners = [
            (old[0] + (new[0] - old[0]) * amount, old[1] + (new[1] - old[1]) * amount)
            for old, new in zip(self.corners, target)
        ]
        self.presence = min(1.0, self.presence + 0.12)
        self.active = True
        self.lost = 0
        self.jumps = 0
        return self.corners

    def compute(self, hands: list[list[object]]) -> list[tuple[float, float]] | None:
        if len(hands) != 2:
            return None
        info = []
        needed = 0.2 if self.active else 0.75
        for landmarks in hands:
            try:
                wrist = landmarks[WRIST]
                thumb = landmarks[THUMB_TIP]
                index = landmarks[INDEX_TIP]
                middle = landmarks[MIDDLE_MCP]
                point = lambda item: (item.x * self.width, item.y * self.height)
                wrist_point, thumb_point, index_point, middle_point = map(point, (wrist, thumb, index, middle))
            except (AttributeError, IndexError):
                return None
            scale = distance(wrist_point, middle_point) + 1
            if distance(thumb_point, index_point) < scale * needed:
                return None
            info.append((index_point, thumb_point, wrist_point[0]))
        info.sort(key=lambda item: item[2])
        left, right = info
        target = [left[0], right[0], right[1], left[1]]
        center_x = sum(point[0] for point in target) / 4
        center_y = sum(point[1] for point in target) / 4
        hull = sorted(target, key=lambda point: math.atan2(point[1] - center_y, point[0] - center_x))
        minimum = 0.0005 if self.active else 0.005
        return target if polygon_area(hull) >= self.width * self.height * minimum else None


def draw_outline(frame: np.ndarray, quad: list[tuple[float, float]], presence: float, time_s: float) -> None:
    import cv2

    overlay = frame.copy()
    for index, point in enumerate(quad):
        next_point = quad[(index + 1) % 4]
        cv2.line(overlay, tuple(map(int, point)), tuple(map(int, next_point)), (245, 245, 245), 2, cv2.LINE_AA)
        radius = int(7 + math.sin(time_s * 3 + index * 1.5) * 1.5)
        cv2.circle(overlay, tuple(map(int, point)), radius, (255, 255, 255), -1, cv2.LINE_AA)
    cv2.addWeighted(overlay, presence, frame, 1 - presence, 0, dst=frame)


def ensure_model(path: Path) -> None:
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".download")
    print("Downloading hand landmarker model …")
    urllib.request.urlretrieve(MODEL_URL, temporary)
    temporary.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("original", nargs="?", default="finger-effect-raw.mp4")
    parser.add_argument("stylized", nargs="?", default="stylized.mp4")
    parser.add_argument("-o", "--output", default="final.mp4")
    args = parser.parse_args()
    import cv2
    import numpy as np

    original_path, stylized_path, output_path = map(Path, (args.original, args.stylized, args.output))
    for path in (original_path, stylized_path):
        if not path.exists(): raise SystemExit(f"Missing input: {path}")
    require_tool("ffmpeg")
    require_tool("ffprobe")
    model_path = Path(__file__).parent / ".cache" / "hand_landmarker.task"
    ensure_model(model_path)

    import mediapipe as mp
    from mediapipe.tasks import python as mp_tasks
    from mediapipe.tasks.python import vision

    original = cv2.VideoCapture(str(original_path))
    stylized = cv2.VideoCapture(str(stylized_path))
    if not original.isOpened() or not stylized.isOpened(): raise SystemExit("Could not open one of the videos.")
    width = int(original.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(original.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = original.get(cv2.CAP_PROP_FPS) or 30.0
    stylized_fps = stylized.get(cv2.CAP_PROP_FPS) or fps
    if width < 2 or height < 2: raise SystemExit("Original video has invalid dimensions.")

    landmarker = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
        base_options=mp_tasks.BaseOptions(model_asset_path=str(model_path)),
        running_mode=vision.RunningMode.VIDEO, num_hands=2,
        min_hand_detection_confidence=0.3, min_hand_presence_confidence=0.3,
        min_tracking_confidence=0.3,
    ))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False, dir=output_path.parent) as temporary:
        raw_output = Path(temporary.name)
    ffmpeg = subprocess.Popen([
        "ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24",
        "-s", f"{width}x{height}", "-r", str(fps), "-i", "-", "-c:v", "libx264",
        "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(raw_output)
    ], stdin=subprocess.PIPE)
    tracker = FrameTracker(width, height)
    stylized_index = -1
    stylized_frame: np.ndarray | None = None
    frame_index = 0
    try:
        while True:
            ok, frame = original.read()
            if not ok: break
            target_index = round((frame_index / fps) * stylized_fps)
            while stylized_index < target_index:
                ok_stylized, candidate = stylized.read()
                if not ok_stylized: break
                stylized_index += 1
                stylized_frame = candidate
            if stylized_frame is not None and stylized_frame.shape[:2] != (height, width):
                stylized_frame = cv2.resize(stylized_frame, (width, height))
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = landmarker.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int(frame_index * 1000 / fps))
            quad = tracker.update(result.hand_landmarks or [])
            if quad is not None and stylized_frame is not None:
                mask = np.zeros((height, width), dtype=np.uint8)
                cv2.fillPoly(mask, [np.array(quad, dtype=np.int32)], 255)
                alpha = (mask.astype(np.float32) / 255 * tracker.presence)[..., None]
                frame = (frame.astype(np.float32) * (1 - alpha) + stylized_frame.astype(np.float32) * alpha).astype(np.uint8)
                draw_outline(frame, quad, tracker.presence, frame_index / fps)
            assert ffmpeg.stdin is not None
            ffmpeg.stdin.write(frame.tobytes())
            frame_index += 1
    finally:
        if ffmpeg.stdin: ffmpeg.stdin.close()
        return_code = ffmpeg.wait()
        original.release(); stylized.release(); landmarker.close()
    if return_code != 0: raise SystemExit(f"ffmpeg failed with exit code {return_code}.")

    audio_check = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", str(original_path)], capture_output=True, text=True, check=False)
    if audio_check.stdout.strip():
        muxed = output_path.with_suffix(".mux.mp4")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw_output), "-i", str(original_path), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-shortest", str(muxed)], check=True)
        muxed.replace(output_path)
    else:
        raw_output.replace(output_path)
    print(f"Done: {output_path}")


if __name__ == "__main__":
    main()
