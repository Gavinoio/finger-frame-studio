# finger-frame-studio

A browser-based creative studio for finger-frame effects. It brings realtime local effects,
realtime Lucy AI transformation, and Gemini video restyling into one desktop-first web app.

[GitHub repository](https://github.com/Gavinoio/finger-frame-studio)

## What it includes

| Mode             | What it does                                                                                  | Available styles                                           |
| ---------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Live Local**   | Tracks the two-hand frame gesture and renders effects entirely in the browser.                | Pixelate, Soft focus, Invert, Noir, Glitch, Toon, Van Gogh |
| **Live Lucy AI** | Sends the live camera stream to Decart Lucy for realtime video-to-video transformation.       | 3D movie, Anime, Cyberpunk, Watercolor, LEGO, Custom       |
| **Video AI**     | Uploads a short clip to Gemini, tracks the finger frame, previews the result, and exports it. | 3D movie, Anime, Clay animation, Watercolor, Custom        |

The integrated app preserves the workflows of the original three projects while sharing camera
handling, MediaPipe tracking, storage, rendering, and export infrastructure.

## Tech stack

- TypeScript
- Vite
- Tailwind CSS
- MediaPipe Hand Landmarker
- Gemini API
- Decart Lucy SDK
- Vitest and Playwright
- Optional Python, OpenCV, MediaPipe, and FFmpeg CLI workflow

## Requirements

- Node.js 20 or newer
- A modern desktop browser
- Camera access for the two live modes
- A Gemini API key for Gemini video generation
- A Decart API key for realtime Lucy AI

Camera access requires a secure context. Use HTTPS in production; localhost is allowed during local
development.

## Quick start

```bash
git clone git@github.com:Gavinoio/finger-frame-studio.git
cd finger-frame-studio
npm install
npm run dev
```

Open [http://localhost:8130](http://localhost:8130).

To test the interface without a camera, open:

```text
http://localhost:8130/?demo
```

Demo mode provides a generated camera stream and fake hand landmarks. It does not connect to Lucy
AI.

## Using the studio

### Live Local

1. Select **Live Local**.
2. Allow camera access.
3. Raise both hands and form a rectangular frame with your thumbs and index fingers.
4. Choose a local style from the left sidebar.
5. Record the canvas or save a still frame.

Local tracking and rendering remain on the device. No API key is required.

### Live Lucy AI

1. Open **Settings** and enter a Decart API key.
2. Select **Live Lucy AI**.
3. Choose a preset or enter a Custom prompt.
4. Connect Lucy to start the realtime AI stream.

Without a Decart key, the workspace can continue with its local visual fallback.

### Video AI

1. Open **Settings** and enter a Gemini API key.
2. Select **Video AI**.
3. Upload a video smaller than 15 MB.
4. Choose a style or enter a Custom prompt.
5. Generate, preview, and export the result.

The placeholder option lets you exercise tracking, compositing, preview, and export without calling
Gemini.

## Keyboard shortcuts

| Shortcut                  | Action                                         |
| ------------------------- | ---------------------------------------------- |
| <kbd>1</kbd>-<kbd>7</kbd> | Select a Live Local effect                     |
| <kbd>1</kbd>-<kbd>6</kbd> | Select a Lucy style                            |
| <kbd>R</kbd>              | Start or stop Live Local recording             |
| <kbd>S</kbd>              | Save the current Live Local frame as PNG       |
| <kbd>Esc</kbd>            | Close Settings or the mobile navigation drawer |

Shortcuts are disabled while typing in an input or textarea.

## API keys and privacy

This is a static, bring-your-own-key application:

- Keys are stored in session storage by default.
- Selecting **Remember this key on this device** stores the key in local storage.
- Keys can be removed at any time from **Settings**.
- Gemini video generation uploads the selected video to Google's API.
- Lucy sends the live video stream to Decart through its realtime service.
- Live Local processing stays in the browser.

Do not use private footage or production credentials unless you understand and accept the policies
of the external service involved. For a public production deployment, a server-side token exchange
or API proxy is recommended.

## Browser export and offline CLI

Browser export records the composited canvas. It does not include the original audio track.

For batch Gemini processing and an H.264 result with the original audio, use the optional Python CLI.
Install Python dependencies and make sure both `ffmpeg` and `ffprobe` are available on `PATH`.

```bash
python -m venv .venv
```

Windows:

```powershell
.venv\Scripts\pip install -r cli\requirements.txt
$env:GEMINI_API_KEY = "your-key"
python -m cli.stylize input.mp4 -o stylized.mp4
python -m cli.composite input.mp4 stylized.mp4 -o final.mp4
```

macOS or Linux:

```bash
.venv/bin/pip install -r cli/requirements.txt
export GEMINI_API_KEY="your-key"
python -m cli.stylize input.mp4 -o stylized.mp4
python -m cli.composite input.mp4 stylized.mp4 -o final.mp4
```

`GOOGLE_API_KEY` can be used instead of `GEMINI_API_KEY`. See [cli/README.md](cli/README.md) for
the compact CLI reference.

## Development

| Command              | Purpose                                |
| -------------------- | -------------------------------------- |
| `npm run dev`        | Start the Vite development server      |
| `npm run typecheck`  | Run TypeScript without emitting files  |
| `npm run lint`       | Run ESLint                             |
| `npm run test`       | Run Vitest unit tests                  |
| `npm run test:watch` | Run unit tests in watch mode           |
| `npm run test:e2e`   | Run the Desktop Chrome Playwright test |
| `npm run build`      | Create a production build in `dist/`   |
| `npm run preview`    | Preview the production build locally   |
| `npm run format`     | Format the project with Prettier       |

Recommended verification before submitting a change:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

## Project structure

```text
finger-frame-studio/
|-- cli/                       # Optional offline video pipeline
|-- src/
|   |-- core/                  # Camera, tracking, drawing, storage, demo mode
|   |-- effects/               # Local effect renderers
|   |-- features/              # Live and video workspaces
|   |-- services/              # MediaPipe, Gemini, and Lucy integrations
|   |-- config.ts              # Styles, prompts, versions, and limits
|   |-- main.ts                # Application shell and interactions
|   `-- tailwind.css           # Tailwind theme and component styles
|-- tests/
|   |-- e2e/                   # Desktop browser regression tests
|   `-- *.test.ts              # Unit tests
`-- .github/workflows/         # GitHub Pages deployment
```

## GitHub Pages

The repository includes [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). A push to
`main` builds the app and deploys `dist/` with GitHub Actions.

In the repository settings:

1. Open **Settings > Pages**.
2. Set **Source** to **GitHub Actions**.
3. Push to `main` or run the workflow manually.

The Vite build uses a relative base path, so it works under the repository's GitHub Pages subpath.

## Known limitations

- The web interface is optimized for desktop browsers.
- Gemini uploads are limited to 15 MB in the browser workflow.
- Browser canvas export does not retain source audio.
- Realtime AI quality and latency depend on the external provider and network conditions.
- MediaPipe and AI SDK resources are loaded from external CDNs or APIs.

## License

No license file is currently included. Unless a license is added, the source code remains subject to
the default copyright rules.
