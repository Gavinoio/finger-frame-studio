import "./tailwind.css";
import { LOCAL_EFFECTS, LUCY_EFFECTS, VIDEO_STYLES } from "./config";
import { formatCameraStatus, isCameraLifecycleStatus } from "./core/camera-status";
import { readSessionOrLocal, saveSecret, hasLocalValue, clearStoredValue } from "./core/storage";
import { LiveWorkspace } from "./features/live-workspace";
import { VideoWorkspace } from "./features/video-workspace";
import type { AppMode, VideoStyleId } from "./types";

const demoMode = new URLSearchParams(location.search).has("demo");
const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("App root not found");

root.innerHTML = `
  <div class="app-shell min-h-screen bg-[#05070c] text-slate-100 antialiased">
    <header class="app-header fixed inset-x-0 top-0 z-40 flex h-[88px] items-center justify-between border-b border-white/10 bg-[#05070c]/90 px-5 backdrop-blur-xl lg:px-8">
      <div class="brand" aria-label="Finger Frame Studio">
        <span class="brand-copy">
          <strong class="brand-title">finger-frame-studio</strong>
        </span>
      </div>
      <div class="header-actions flex items-center gap-2">
        <a class="header-button github-link inline-flex h-10 items-center gap-2 rounded-xl border border-transparent bg-transparent px-3 text-sm font-medium text-slate-200 transition hover:border-white/10 hover:bg-white/5 hover:text-white" href="https://github.com/Gavinoio/finger-frame-studio" target="_blank" rel="noopener noreferrer" aria-label="Open finger-frame-studio on GitHub">
          <span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.28-.36 6.72-1.61 6.72-7.25A5.65 5.65 0 0 0 19.22 3.3 5.3 5.3 0 0 0 19.08.3S17.9-.08 15 1.8a13.4 13.4 0 0 0-6 0C6.1-.08 4.92.3 4.92.3a5.3 5.3 0 0 0-.14 3A5.65 5.65 0 0 0 3.28 7.3c0 5.6 3.44 6.85 6.72 7.25A4.8 4.8 0 0 0 9 18v4" /><path d="M9 19c-3 .92-3-1.5-4-2" /></svg></span>
          <span>GitHub</span>
        </a>
        <button class="header-button help-button inline-flex h-10 items-center gap-2 rounded-xl border border-transparent bg-transparent px-3 text-sm font-medium text-slate-200 transition hover:border-white/10 hover:bg-white/5 hover:text-white" id="help-button" type="button">
          <span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.4 2.4 0 1 1 3.1 2.3c-.7.3-.9.8-.9 1.7M12 17h.01" /></svg></span>
          <span>Help</span>
        </button>
        <button class="header-button settings-nav inline-flex h-10 items-center gap-2 rounded-xl border border-transparent bg-transparent px-3 text-sm font-medium text-slate-200 transition hover:border-white/10 hover:bg-white/5 hover:text-white" id="settings-button" type="button" aria-label="API Settings">
          <span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg></span>
          <span>Settings</span>
        </button>
      </div>
    </header>
    <aside class="sidebar fixed z-30 hidden flex-col backdrop-blur-xl lg:flex" id="sidebar" aria-label="Studio navigation">
      <div class="sidebar-header">
        <button class="icon-button sidebar-toggle" id="sidebar-toggle" type="button" aria-label="Collapse sidebar" aria-expanded="true">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
      <div class="sidebar-mode-heading">Modes</div>
      <nav class="mode-nav flex flex-col gap-2" aria-label="Product modes">
        <button class="mode-button active flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition" data-mode="live-local" aria-label="Live Local">
          <span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="12" cy="12" r="3.25" /></svg></span>
          <span class="mode-copy"><strong>Live Local</strong><small>On-device effects</small></span>
        </button>
        <button class="mode-button flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition" data-mode="live-lucy" aria-label="Live Lucy AI">
          <span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.5" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" /></svg></span>
          <span class="mode-copy"><strong>Live Lucy AI</strong><small>Realtime AI effects</small></span>
        </button>
        <button class="mode-button flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition" data-mode="video-ai" aria-label="Video AI">
          <span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M17 5v14M3 9h4M17 9h4M3 15h4M17 15h4" /></svg></span>
          <span class="mode-copy"><strong>Video AI</strong><small>AI video editing</small></span>
        </button>
      </nav>
      <div class="sidebar-effects" aria-label="Effect styles">
        <section class="sidebar-effect-panel active" data-effect-panel="live-local">
          <div class="sidebar-section-heading">
            <span>Local styles</span>
            <small>1-7</small>
          </div>
          <div class="effect-strip" id="local-effects" role="toolbar" aria-label="Local effects"></div>
        </section>
        <section class="sidebar-effect-panel" data-effect-panel="live-lucy">
          <div class="sidebar-section-heading">
            <span>Lucy styles</span>
            <small>1-6</small>
          </div>
          <div class="effect-strip" id="lucy-effects" role="toolbar" aria-label="Lucy styles"></div>
        </section>
      </div>
    </aside>
    <button class="drawer-backdrop" id="drawer-backdrop" type="button" aria-label="Close navigation"></button>

    <div class="workspace min-h-screen pt-[88px]">
      <button class="icon-button mobile-menu-button fixed bottom-5 left-5 z-40 grid h-12 w-12 place-items-center rounded-full bg-slate-900 text-white shadow-xl lg:hidden" id="mobile-menu-button" type="button" aria-label="Open navigation">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>

      <main class="main-content w-full p-4 sm:p-5">
      <section class="view active space-y-5" id="view-live-local" data-view="live-local">
        <div class="stage-card overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 shadow-[0_24px_70px_rgba(15,23,42,.18)]">
          <div class="stage-topbar">
            <div class="status-chip" id="live-status" aria-live="polite">Preparing</div>
          </div>
          <button class="stage-fullscreen-button" id="fullscreen-button" type="button" aria-label="Enter fullscreen"><svg viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /></svg></button>
          <div class="stage relative aspect-video w-full overflow-hidden bg-black" id="live-stage">
            <video class="source-video" id="live-camera" autoplay playsinline muted></video>
            <video class="source-video" id="lucy-video" autoplay playsinline muted></video>
            <canvas id="live-canvas" aria-label="Live hand effect preview"></canvas>
            <div class="stage-message" id="live-message">
              <strong>Get ready to frame your shot</strong>
              <small class="stage-tagline">Creative finger-frame effects <b>·</b> Explore endless possibilities</small>
            </div>
            <div class="focus-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
            <button class="shutter-button record-control" id="record-button" type="button" aria-label="Start recording" disabled><span class="record-glyph" aria-hidden="true"></span><small id="recording-time" hidden>00:00</small></button>
          </div>
        </div>
      </section>

      <section class="view space-y-5" id="view-live-lucy" data-view="live-lucy">
        <div class="stage-card overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 shadow-[0_24px_70px_rgba(15,23,42,.18)]">
          <div class="stage-topbar">
            <div class="status-chip" id="lucy-status" aria-live="polite">Not connected</div>
          </div>
          <div class="stage relative aspect-video w-full overflow-hidden bg-black" id="lucy-stage">
            <video class="source-video" id="lucy-camera" autoplay playsinline muted></video>
            <video class="source-video" id="lucy-remote" autoplay playsinline muted></video>
            <canvas id="lucy-canvas" aria-label="Live Lucy AI preview"></canvas>
            <div class="stage-message" id="lucy-message"><strong>Connect to Lucy AI</strong><span>Generate your finger-framed world in real time</span></div>
            <div class="focus-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
          </div>
        </div>
        <div class="controls-card live-controls rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div class="control-row">
            <button class="primary-button" id="lucy-connect">Connect Lucy</button>
            <button class="ghost-button" id="lucy-disconnect">Disconnect</button>
          </div>
          <div class="control-row">
            <label class="field field-wide">
              <span class="control-label">Custom Prompt</span>
              <textarea id="lucy-custom" rows="1"></textarea>
            </label>
          </div>
        </div>
      </section>

      <section class="view space-y-5" id="view-video-ai" data-view="video-ai">
        <div class="video-card rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div class="video-card-header">
            <div>
              <h2>Video style</h2>
              <p class="video-description">Upload a short clip, let Gemini restyle the world inside your finger frame, then preview or export the result.</p>
              <p class="video-note">AI generation uploads the video to Google Gemini and may incur charges. Confirm your privacy and quota before continuing.</p>
            </div>
            <div class="status-chip" id="video-status" aria-live="polite">Waiting for video</div>
          </div>
          <div class="key-grid">
            <div class="field">
              <label for="video-style">Style</label>
              <select id="video-style"></select>
            </div>
            <div class="field">
              <label for="video-custom">Custom prompt</label>
              <textarea id="video-custom" rows="1"></textarea>
            </div>
          </div>
        </div>
        <label class="drop-card grid min-h-40 cursor-pointer place-items-center rounded-[28px] border-2 border-dashed border-slate-300 bg-white p-8 text-center transition hover:border-violet-400 hover:bg-violet-50/50" id="video-drop" for="video-file">
          <input id="video-file" type="file" accept="video/*" />
          <strong>Drop a video or click to choose</strong>
        </label>
        <div class="video-stage" id="video-stage">
          <div class="stage-card overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 shadow-xl">
            <div class="stage relative aspect-video w-full overflow-hidden bg-black">
              <video class="source-video" id="video-original" playsinline muted></video>
              <video class="source-video" id="video-styled" playsinline muted></video>
              <canvas id="video-canvas" aria-label="Video AI preview"></canvas>
            </div>
          </div>
          <div class="video-controls">
            <button class="primary-button" id="video-generate">Generate AI video</button>
            <button class="ghost-button" id="video-placeholder">Use placeholder</button>
            <button class="ghost-button" id="video-preview" disabled>Preview</button>
            <button class="ghost-button" id="video-export" disabled>Export</button>
            <button class="ghost-button" id="video-cancel">Cancel</button>
          </div>
        </div>
      </section>

      <section class="settings-card fixed right-4 top-20 z-50 w-[min(520px,calc(100vw-2rem))] rounded-[28px] border border-slate-200 bg-white p-5 shadow-2xl sm:p-6" id="settings-panel" aria-label="API key settings">
        <div class="settings-heading">
          <div class="settings-title">
            <h2>API key settings</h2>
            <p>Configure the access keys required by AI services</p>
          </div>
          <button class="icon-button settings-close" id="settings-close" type="button" aria-label="Close API key settings">×</button>
        </div>
        <div class="key-grid settings-key-grid">
          <div class="field settings-key-field">
            <label for="gemini-key">Gemini API key</label>
            <span class="field-description">Used for Video AI restyling</span>
            <input id="gemini-key" type="password" autocomplete="off" placeholder="Enter your Gemini API key" />
            <label class="check"><input id="gemini-remember" type="checkbox" /> <span>Remember this key on this device</span></label>
          </div>
          <div class="field settings-key-field">
            <label for="decart-key">Decart API key</label>
            <span class="field-description">Used for realtime Lucy AI restyling</span>
            <input id="decart-key" type="password" autocomplete="off" placeholder="Enter your Decart API key" />
            <label class="check"><input id="decart-remember" type="checkbox" /> <span>Remember this key on this device</span></label>
          </div>
        </div>
        <div class="control-row settings-actions">
          <button class="ghost-button" id="clear-keys">Clear keys</button>
          <button class="primary-button" id="save-keys">Save settings</button>
        </div>
      </section>
      </main>
    </div>
  </div>
`;

const $ = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
};

const liveCanvas = $("#live-canvas") as HTMLCanvasElement;
const liveCamera = $("#live-camera") as HTMLVideoElement;
const lucyCanvas = $("#lucy-canvas") as HTMLCanvasElement;
const videoCanvas = $("#video-canvas") as HTMLCanvasElement;
const liveStatus = $("#live-status") as HTMLElement;
const lucyStatus = $("#lucy-status") as HTMLElement;
const videoStatus = $("#video-status") as HTMLElement;
const settingsPanel = $("#settings-panel") as HTMLElement;
const geminiKey = $("#gemini-key") as HTMLInputElement;
const decartKey = $("#decart-key") as HTMLInputElement;
const geminiRemember = $("#gemini-remember") as HTMLInputElement;
const decartRemember = $("#decart-remember") as HTMLInputElement;
const videoStage = $("#video-stage");
const videoPreview = $("#video-preview") as HTMLButtonElement;
const videoExport = $("#video-export") as HTMLButtonElement;
const appShell = $(".app-shell") as HTMLElement;
const sidebarToggle = $("#sidebar-toggle") as HTMLButtonElement;
const mobileMenuButton = $("#mobile-menu-button") as HTMLButtonElement;
const drawerBackdrop = $("#drawer-backdrop") as HTMLButtonElement;
const desktopSidebarQuery = window.matchMedia("(min-width: 901px)");

const setMobileDrawer = (open: boolean): void => {
  appShell.classList.toggle("sidebar-open", open);
  mobileMenuButton.setAttribute("aria-expanded", String(open));
};

sidebarToggle.addEventListener("click", () => {
  if (!desktopSidebarQuery.matches) {
    setMobileDrawer(false);
    return;
  }
  const collapsed = appShell.classList.toggle("sidebar-collapsed");
  sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  sidebarToggle.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
});
mobileMenuButton.addEventListener("click", () => setMobileDrawer(true));
drawerBackdrop.addEventListener("click", () => setMobileDrawer(false));

const recordButton = $("#record-button") as HTMLButtonElement;
const recordingTime = $("#recording-time") as HTMLElement;
let liveRecorder: MediaRecorder | null = null;
let liveRecordingStream: MediaStream | null = null;
let liveRecordingChunks: Blob[] = [];
let liveRecordingStartedAt = 0;
let liveRecordingTimer = 0;
let discardLiveRecording = false;

const hasActiveCamera = (): boolean => {
  const stream = liveCamera.srcObject;
  return (
    stream instanceof MediaStream &&
    stream.getVideoTracks().some((track) => track.enabled && track.readyState === "live") &&
    liveCamera.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    liveCamera.videoWidth > 0 &&
    liveCamera.videoHeight > 0
  );
};

const syncRecordButtonAvailability = (): void => {
  if (liveRecorder?.state === "recording") {
    recordButton.disabled = false;
    return;
  }
  const available = hasActiveCamera();
  recordButton.disabled = !available;
  recordButton.title = available ? "Start video recording" : "Connect the camera first";
};

const updateRecordingTime = (): void => {
  const elapsed = Math.floor((performance.now() - liveRecordingStartedAt) / 1000);
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  recordingTime.textContent = `${minutes}:${seconds}`;
};

const resetRecordingUI = (): void => {
  window.clearInterval(liveRecordingTimer);
  liveRecordingTimer = 0;
  recordButton.classList.remove("recording");
  recordButton.setAttribute("aria-label", "Start recording");
  recordingTime.hidden = true;
  recordingTime.textContent = "00:00";
  syncRecordButtonAvailability();
};

const startLiveRecording = (): void => {
  if (!window.MediaRecorder || !liveCanvas.captureStream) {
    setStatus(liveStatus, "This browser does not support video recording.", "error");
    return;
  }
  if (!hasActiveCamera()) {
    setStatus(liveStatus, "Connect the camera first.", "error");
    syncRecordButtonAvailability();
    return;
  }
  const mimeType =
    ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find(
      (value) => MediaRecorder.isTypeSupported(value),
    ) || "video/webm";
  liveRecordingChunks = [];
  discardLiveRecording = false;
  liveRecordingStream = liveCanvas.captureStream(30);
  liveRecorder = new MediaRecorder(liveRecordingStream, {
    mimeType,
    videoBitsPerSecond: 10_000_000,
  });
  liveRecorder.ondataavailable = (event) => {
    if (event.data.size) liveRecordingChunks.push(event.data);
  };
  liveRecorder.onerror = () => {
    setStatus(liveStatus, "Video recording failed.", "error");
  };
  liveRecorder.onstop = () => {
    if (!discardLiveRecording && liveRecordingChunks.length) {
      const blob = new Blob(liveRecordingChunks, { type: mimeType });
      const extension = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `finger-frame-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    liveRecordingStream?.getTracks().forEach((track) => track.stop());
    liveRecordingStream = null;
    liveRecorder = null;
    liveRecordingChunks = [];
    resetRecordingUI();
  };
  liveRecorder.start(1000);
  liveRecordingStartedAt = performance.now();
  recordButton.classList.add("recording");
  recordButton.setAttribute("aria-label", "Stop recording and export video");
  recordingTime.hidden = false;
  updateRecordingTime();
  liveRecordingTimer = window.setInterval(updateRecordingTime, 1000);
};

const stopLiveRecording = (discard = false): void => {
  if (!liveRecorder || liveRecorder.state === "inactive") return;
  discardLiveRecording = discard;
  liveRecorder.stop();
};

recordButton.addEventListener("click", () => {
  if (liveRecorder?.state === "recording") stopLiveRecording();
  else startLiveRecording();
});
$("#fullscreen-button").addEventListener("click", () => {
  if (document.fullscreenElement) void document.exitFullscreen?.();
  else void $("#view-live-local .stage-card").requestFullscreen?.();
});
$("#help-button").addEventListener("click", () => {
  window.alert(
    "Use your thumbs and index fingers to make a frame, then choose a style on the left for a live preview. Press S to save the current frame.",
  );
});

const liveWorkspace = new LiveWorkspace(
  { canvas: liveCanvas, camera: liveCamera, lucy: $("#lucy-video") },
  {
    onStatus: (message, kind = "normal") => setStatus(liveStatus, message, kind),
    onTracking: (state) => $("#live-message").classList.toggle("sr-only", state.active),
  },
  demoMode,
);
const lucyWorkspace = new LiveWorkspace(
  { canvas: lucyCanvas, camera: $("#lucy-camera"), lucy: $("#lucy-remote") },
  {
    onStatus: (message, kind = "normal") => setStatus(lucyStatus, message, kind),
    onTracking: (state) => $("#lucy-message").classList.toggle("sr-only", state.active),
  },
  demoMode,
);
const videoWorkspace = new VideoWorkspace(
  { canvas: videoCanvas, original: $("#video-original"), styled: $("#video-styled") },
  {
    onStatus: (message, kind = "normal") => setStatus(videoStatus, message, kind),
    onReady: (ready) => {
      videoPreview.disabled = !ready;
      videoExport.disabled = !ready;
    },
    onTracking: () => undefined,
  },
);

liveWorkspace.configureKey(() => decartKey.value);
lucyWorkspace.configureKey(() => decartKey.value);

function setStatus(element: HTMLElement, message: string, kind: string): void {
  let displayMessage = message;
  const isLiveCameraStatus =
    element === liveStatus || (element === lucyStatus && isCameraLifecycleStatus(message));
  if (isLiveCameraStatus) {
    displayMessage = formatCameraStatus(message, kind, demoMode, element === liveStatus) ?? message;
    element.title = message;
  }
  if (element === liveStatus) {
    window.requestAnimationFrame(() => {
      syncRecordButtonAvailability();
      const stream = liveCamera.srcObject;
      if (stream instanceof MediaStream) {
        stream
          .getVideoTracks()
          .forEach((track) =>
            track.addEventListener("ended", syncRecordButtonAvailability, { once: true }),
          );
      }
    });
  }
  element.textContent = displayMessage;
  element.className = `status-chip ${kind === "busy" ? "busy" : kind === "live" || kind === "ready" ? "live" : kind === "error" ? "error" : ""}`;
}

function buildEffects(): void {
  const localContainer = $("#local-effects");
  const lucyContainer = $("#lucy-effects");
  LOCAL_EFFECTS.forEach((effect, index) => {
    const button = document.createElement("button");
    button.className = `effect-button${effect.id === "vangogh" ? " active" : ""}`;
    button.innerHTML = `<span class="effect-thumb effect-thumb-${effect.id}"><small>${String(index + 1).padStart(2, "0")}</small></span><span class="effect-name">${effect.label}</span><span class="effect-check">✓</span>`;
    button.dataset.effect = effect.id;
    button.addEventListener("click", () => {
      localContainer.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      liveWorkspace.setLocalEffect(effect.id);
    });
    localContainer.append(button);
  });
  LUCY_EFFECTS.forEach((effect, index) => {
    const button = document.createElement("button");
    button.className = `effect-button${effect.id === "movie3d" ? " active" : ""}`;
    button.dataset.effect = effect.id;
    button.innerHTML = `<span class="effect-thumb effect-thumb-${effect.id}"><small>${String(index + 1).padStart(2, "0")}</small></span><span class="effect-name">${effect.label}</span><span class="effect-check">✓</span>`;
    button.addEventListener("click", () => {
      lucyContainer.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      lucyWorkspace.setLucyEffect(effect.id);
      if (effect.id === "custom" && !lucyCustom.value.trim()) lucyCustom.focus();
    });
    lucyContainer.append(button);
  });
  const videoStyle = $("#video-style") as HTMLSelectElement;
  VIDEO_STYLES.forEach((style) => {
    const option = document.createElement("option");
    option.value = style.id;
    option.textContent = style.label;
    videoStyle.append(option);
  });
}
buildEffects();

let activeMode: AppMode = "live-local";

function setMode(mode: AppMode): void {
  activeMode = mode;
  setMobileDrawer(false);
  if (mode !== "live-local") stopLiveRecording();
  document
    .querySelectorAll<HTMLElement>("[data-view]")
    .forEach((view) => view.classList.toggle("active", view.dataset.view === mode));
  document
    .querySelectorAll<HTMLButtonElement>("[data-mode]")
    .forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  document
    .querySelectorAll<HTMLElement>("[data-effect-panel]")
    .forEach((panel) => panel.classList.toggle("active", panel.dataset.effectPanel === mode));
  document
    .querySelector<HTMLElement>(".sidebar-effects")
    ?.classList.toggle("hidden", mode === "video-ai");
  if (mode === "live-local") {
    liveWorkspace.setEngine("local");
    void liveWorkspace.start().catch(() => undefined);
    void lucyWorkspace.stop();
  } else if (mode === "live-lucy") {
    lucyWorkspace.setEngine("lucy");
    void lucyWorkspace
      .start()
      .then(() => (decartKey.value.trim() ? lucyWorkspace.connectLucy() : undefined))
      .catch(() => undefined);
    void liveWorkspace.stop();
  } else {
    void liveWorkspace.stop();
    void lucyWorkspace.stop();
  }
}

document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode as AppMode));
});

$("#settings-button").addEventListener("click", () => {
  settingsPanel.classList.toggle("visible");
  setMobileDrawer(false);
});
$("#settings-close").addEventListener("click", () => settingsPanel.classList.remove("visible"));
$("#save-keys").addEventListener("click", async () => {
  saveSecret("finger-frame:gemini-key", geminiKey.value.trim(), geminiRemember.checked);
  saveSecret("finger-frame:decart-key", decartKey.value.trim(), decartRemember.checked);
  if (activeMode === "live-lucy") {
    await lucyWorkspace.disconnectLucy();
    if (decartKey.value.trim()) await lucyWorkspace.connectLucy();
  }
  settingsPanel.classList.remove("visible");
  setStatus(lucyStatus, "Settings saved.", "ready");
});
$("#clear-keys").addEventListener("click", async () => {
  geminiKey.value = "";
  decartKey.value = "";
  clearStoredValue("finger-frame:gemini-key");
  clearStoredValue("finger-frame:decart-key");
  await lucyWorkspace.disconnectLucy();
  await liveWorkspace.disconnectLucy();
  setStatus(lucyStatus, "Keys cleared.", "normal");
});

geminiKey.value = readSessionOrLocal("finger-frame:gemini-key");
decartKey.value = readSessionOrLocal("finger-frame:decart-key");
geminiRemember.checked = hasLocalValue("finger-frame:gemini-key");
decartRemember.checked = hasLocalValue("finger-frame:decart-key");

$("#lucy-connect").addEventListener("click", () => {
  if (!decartKey.value.trim()) settingsPanel.classList.add("visible");
  void lucyWorkspace.connectLucy();
});
$("#lucy-disconnect").addEventListener("click", () => void lucyWorkspace.disconnectLucy());
const lucyCustom = $("#lucy-custom") as HTMLTextAreaElement;
const lucyCustomStorageKey = "finger-frame:lucy-custom";
lucyCustom.value = localStorage.getItem(lucyCustomStorageKey) || "";
lucyWorkspace.setCustomPrompt(lucyCustom.value);
lucyCustom.addEventListener("input", () => {
  lucyWorkspace.setCustomPrompt(lucyCustom.value);
  try {
    localStorage.setItem(lucyCustomStorageKey, lucyCustom.value);
  } catch {
    // The prompt still remains available for the current page session.
  }
});

const videoInput = $("#video-file") as HTMLInputElement;
const videoDrop = $("#video-drop") as HTMLLabelElement;
const videoCustom = $("#video-custom") as HTMLTextAreaElement;
const videoStyle = $("#video-style") as HTMLSelectElement;
const videoGenerate = $("#video-generate") as HTMLButtonElement;
const videoStyleStorageKey = "finger-frame:video-style";
const videoCustomStorageKey = "finger-frame:video-custom";
const savedVideoStyle = localStorage.getItem(videoStyleStorageKey);
if (savedVideoStyle && VIDEO_STYLES.some((style) => style.id === savedVideoStyle)) {
  videoStyle.value = savedVideoStyle;
}
videoCustom.value = localStorage.getItem(videoCustomStorageKey) || "";
const syncVideoCustomVisibility = (): void => {
  videoCustom
    .closest<HTMLElement>(".field")
    ?.classList.toggle("hidden", videoStyle.value !== "custom");
};
syncVideoCustomVisibility();
videoStyle.addEventListener("change", () => {
  syncVideoCustomVisibility();
  if (videoStyle.value === "custom") videoCustom.focus();
  try {
    localStorage.setItem(videoStyleStorageKey, videoStyle.value);
  } catch {
    // Keep the selected style in memory when storage is unavailable.
  }
});
videoCustom.addEventListener("input", () => {
  try {
    localStorage.setItem(videoCustomStorageKey, videoCustom.value);
  } catch {
    // Keep the custom prompt in memory when storage is unavailable.
  }
});

const loadVideoFile = async (file: File | undefined) => {
  if (!file) return;
  try {
    await videoWorkspace.loadFile(file);
    videoStage.classList.add("visible");
  } catch (error) {
    setStatus(
      videoStatus,
      error instanceof Error ? error.message : "Video failed to load.",
      "error",
    );
  }
};
videoInput.addEventListener("change", () => void loadVideoFile(videoInput.files?.[0]));
videoDrop.addEventListener("dragover", (event) => {
  event.preventDefault();
  videoDrop.classList.add("dragover");
});
videoDrop.addEventListener("dragleave", () => videoDrop.classList.remove("dragover"));
videoDrop.addEventListener("drop", (event) => {
  event.preventDefault();
  videoDrop.classList.remove("dragover");
  void loadVideoFile(event.dataTransfer?.files[0]);
});

const sourceParameter = new URLSearchParams(location.search).get("src");
if (sourceParameter) {
  void fetch(sourceParameter)
    .then((response) => {
      if (!response.ok)
        throw new Error(`Could not load ${sourceParameter}: HTTP ${response.status}`);
      return response.blob();
    })
    .then((blob) => {
      const name = sourceParameter.split(/[\\/]/).pop() || "source-video.mp4";
      return loadVideoFile(new File([blob], name, { type: blob.type || "video/quicktime" }));
    })
    .catch((error) =>
      setStatus(
        videoStatus,
        error instanceof Error ? error.message : "Video failed to load.",
        "error",
      ),
    );
}

videoGenerate.addEventListener("click", () => {
  if (!geminiKey.value.trim()) {
    settingsPanel.classList.add("visible");
    setStatus(
      videoStatus,
      "Enter a Gemini API key in Settings first, or use the placeholder style.",
      "normal",
    );
    return;
  }
  const selected = VIDEO_STYLES.find((style) => style.id === (videoStyle.value as VideoStyleId));
  const prompt = videoStyle.value === "custom" ? videoCustom.value : selected?.prompt || "";
  void videoWorkspace.generate(geminiKey.value, prompt);
});
$("#video-placeholder").addEventListener("click", () => videoWorkspace.usePlaceholder());
videoPreview.addEventListener("click", () => void videoWorkspace.preview());
videoExport.addEventListener("click", () => void videoWorkspace.export());
$("#video-cancel").addEventListener("click", () => videoWorkspace.cancelGeneration());

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setMobileDrawer(false);
    settingsPanel.classList.remove("visible");
  }
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
    return;
  if (event.key.toLowerCase() === "r") {
    event.preventDefault();
    if (liveRecorder?.state === "recording") stopLiveRecording();
    else startLiveRecording();
    return;
  }
  if (event.key.toLowerCase() === "s" && activeMode === "live-local") {
    event.preventDefault();
    const anchor = document.createElement("a");
    anchor.href = liveCanvas.toDataURL("image/png");
    anchor.download = `finger-frame-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    anchor.click();
    setStatus(liveStatus, "Snapshot saved", "ready");
    return;
  }
  const index = Number(event.key) - 1;
  const effects = activeMode === "live-lucy" ? LUCY_EFFECTS : LOCAL_EFFECTS;
  if (activeMode === "video-ai" || index < 0 || index >= effects.length) return;
  const effect = effects[index];
  if (!effect) return;
  const container = activeMode === "live-lucy" ? $("#lucy-effects") : $("#local-effects");
  container.querySelector<HTMLButtonElement>(`button[data-effect="${effect.id}"]`)?.click();
});

window.addEventListener("pagehide", () => {
  stopLiveRecording(true);
  liveWorkspace.dispose();
  lucyWorkspace.dispose();
  videoWorkspace.dispose();
});

setMode("live-local");

declare global {
  interface Window {
    __fingerFrameStudio?: { liveWorkspace: LiveWorkspace; videoWorkspace: VideoWorkspace };
    __step?: (time: number) => ReturnType<VideoWorkspace["step"]>;
  }
}
window.__fingerFrameStudio = { liveWorkspace, videoWorkspace };
window.__step = (time) => videoWorkspace.step(time);
