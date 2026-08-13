#!/usr/bin/env python3
"""Restyle a video with Gemini Omni Flash."""

from __future__ import annotations

import argparse
import base64
import os
import sys
import time
from pathlib import Path

MODEL = "gemini-omni-flash-preview"
DEFAULT_PROMPT = (
    "Transform the person into a 3D animated movie character with a stylized CGI look. "
    "This is a strict pixel-aligned edit: keep the same pose, motion, timing, framing, "
    "background, face position, expression, blinks and gaze. Change only the visual style."
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", nargs="?", default="finger-effect-raw.mp4", help="Input video path")
    parser.add_argument("-o", "--output", default="stylized.mp4")
    parser.add_argument("-p", "--prompt", default=DEFAULT_PROMPT)
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        sys.exit("Set GEMINI_API_KEY or GOOGLE_API_KEY first.")
    input_path = Path(args.video)
    output_path = Path(args.output)
    if not input_path.exists():
        sys.exit(f"Input video not found: {input_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    from google import genai

    client = genai.Client(api_key=api_key)
    print(f"Uploading {input_path} …")
    uploaded = client.files.upload(file=str(input_path))
    started = time.monotonic()
    while "PROCESS" in str(getattr(uploaded, "state", "")).upper():
        if time.monotonic() - started > 900:
            sys.exit("Timed out while processing the uploaded file.")
        time.sleep(3)
        uploaded = client.files.get(name=uploaded.name)

    interaction = client.interactions.create(
        model=MODEL,
        input=[
            {"type": "document", "uri": uploaded.uri},
            {"type": "text", "text": args.prompt},
        ],
    )
    print("Generating video …")
    started = time.monotonic()
    while str(getattr(interaction, "status", "")).lower() in {
        "pending", "in_progress", "processing", "running", "queued"
    }:
        if time.monotonic() - started > 1800:
            sys.exit("Timed out while generating the video.")
        time.sleep(5)
        interaction = client.interactions.get(id=interaction.id)
        print(f"  {getattr(interaction, 'status', 'working')}")

    status = str(getattr(interaction, "status", "")).lower()
    if status in {"failed", "error", "cancelled", "canceled"}:
        sys.exit(f"Gemini generation failed: {interaction}")
    output = getattr(interaction, "output_video", None)
    if output is None:
        sys.exit(f"No output video in response: {interaction}")

    data = getattr(output, "data", None)
    if data:
        decoded = base64.b64decode(data) if isinstance(data, str) else data
        output_path.write_bytes(decoded)
    else:
        uri = getattr(output, "uri", None)
        if not uri:
            sys.exit("Output video has neither data nor uri.")
        name = f"files/{uri.split('/files/', 1)[1].split('?', 1)[0]}" if "/files/" in uri else uri
        file = None
        for _ in range(180):
            file = client.files.get(name=name)
            if "ACTIVE" in str(getattr(file, "state", "")).upper():
                break
            time.sleep(5)
        if file is None or "ACTIVE" not in str(getattr(file, "state", "")).upper():
            sys.exit("Timed out while waiting for the output file.")
        downloaded = client.files.download(file=file)
        output_path.write_bytes(downloaded if isinstance(downloaded, bytes) else bytes(downloaded))

    if not output_path.exists() or output_path.stat().st_size == 0:
        sys.exit("Gemini returned an empty output file.")
    print(f"Done: {output_path}")


if __name__ == "__main__":
    main()
