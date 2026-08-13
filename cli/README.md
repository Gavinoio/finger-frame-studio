# Offline CLI

The web app is static and runs in the browser. These optional commands are for
batch processing and for exporting an H.264 video with the original audio track.

```bash
python -m venv .venv
# Windows: .venv\Scripts\pip install -r cli\requirements.txt
# macOS/Linux: .venv/bin/pip install -r cli/requirements.txt
python -m cli.stylize input.mp4 -o stylized.mp4
python -m cli.composite input.mp4 stylized.mp4 -o final.mp4
```

Install `ffmpeg` and `ffprobe` separately and make sure they are on `PATH`.
Set `GEMINI_API_KEY` or `GOOGLE_API_KEY` before running `stylize`.
