# Finger Frame Studio

A unified Finger Frame product that combines three experiences in one responsive page.

The integrated interface is built with TypeScript, Vite, and Tailwind CSS. It preserves the full
local-effects, Gemini video, Lucy realtime, browser export, demo, and offline CLI workflows of the
three source projects while sharing tracking, media, storage, and rendering infrastructure.

- **Live Local**: Pixelate, Soft focus, Invert, Noir, Glitch, Toon, and Van Gogh.
- **Live Lucy AI**: 3D movie, Anime, Cyberpunk, Watercolor, LEGO, and custom prompts.
- **Video AI**: upload a video, stylize it with Gemini, composite the finger frame, preview, and export.

Hand tracking and local effects run in the browser. Gemini and Decart require your own API keys.
This is a static GitHub Pages version; keys stay in the current session by default and are only
written to browser storage when you choose to remember them. Do not upload private video to
unauthorized cloud services.

## Local development

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the Vite URL in a browser. For camera-free debugging, use:

```text
http://localhost:8130/?demo
```

## Checks and build

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## GitHub Pages

Push this directory as an independent GitHub repository to the `main` branch and set the Pages
source to GitHub Actions. `.github/workflows/deploy.yml` builds and publishes the site.

Users can visit the Pages URL directly, or clone the repository, edit `src/`, run the tests, and
build again.

## Offline CLI

The Python CLI in `cli/` supports Gemini batch processing and H.264 compositing with audio. It
requires Python, MediaPipe, OpenCV, NumPy, the Gemini SDK, and system-level `ffmpeg` / `ffprobe`.
See `cli/README.md` for details.

```bash
python -m cli.stylize input.mp4 -o stylized.mp4
python -m cli.composite input.mp4 stylized.mp4 -o final.mp4
```

## License and sources

This project retains the creative direction and core implementation ideas of the original three
projects. External MediaPipe, Gemini, and Decart SDKs are used under their respective licenses and
terms of service. Add your license, source repository, and privacy policy links before publishing.
