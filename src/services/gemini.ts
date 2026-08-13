import { GEMINI_BASE_URL, GEMINI_MODEL, MAX_VIDEO_BYTES, PROMPT_SUFFIX } from "../config";
import type { VideoGenerator } from "../types";

type JsonObject = Record<string, unknown>;

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

function isPending(value: JsonObject): boolean {
  const status = String(value.status || value.state || "").toLowerCase();
  return ["pending", "in_progress", "processing", "running", "queued"].some((item) =>
    status.includes(item),
  );
}

function isFailed(value: JsonObject): boolean {
  const status = String(value.status || value.state || "").toLowerCase();
  return ["failed", "error", "cancelled", "canceled", "rejected"].some((item) =>
    status.includes(item),
  );
}

function getOutputVideo(interaction: JsonObject): JsonObject | null {
  const direct = [interaction.output_video, interaction.outputVideo];
  for (const candidate of direct) {
    if (candidate && typeof candidate === "object") return candidate as JsonObject;
  }

  const lists: unknown[][] = [];
  for (const key of ["outputs", "output", "content"]) {
    const value = interaction[key];
    if (Array.isArray(value)) lists.push(value);
  }
  const steps = interaction.steps;
  if (Array.isArray(steps)) {
    for (const step of steps) {
      if (step && typeof step === "object" && Array.isArray((step as JsonObject).content)) {
        lists.push((step as JsonObject).content as unknown[]);
      }
    }
  }

  for (const list of lists) {
    const item = list.find((candidate) => {
      if (!candidate || typeof candidate !== "object") return false;
      const value = candidate as JsonObject;
      return (
        String(value.type || "").includes("video") ||
        Boolean(value.video) ||
        String(value.mime_type || "").startsWith("video")
      );
    });
    if (item && typeof item === "object") {
      const value = item as JsonObject;
      return (value.video as JsonObject | undefined) || value;
    }
  }
  return null;
}

async function fileToBase64(file: File, signal: AbortSignal): Promise<string> {
  if (signal.aborted) throw new DOMException("Request cancelled", "AbortError");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    if (signal.aborted) throw new DOMException("Request cancelled", "AbortError");
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export function buildGeminiPrompt(style: string): string {
  return `${style.trim()}${PROMPT_SUFFIX}`;
}

export class GeminiVideoGenerator implements VideoGenerator {
  constructor(
    private readonly apiKey: () => string,
    private readonly onProgress: (message: string) => void = () => undefined,
  ) {}

  async generate(input: File, prompt: string, signal: AbortSignal): Promise<Blob> {
    const key = this.apiKey().trim();
    if (!key) throw new GeminiError("Enter a Gemini API key first.");
    if (input.size > MAX_VIDEO_BYTES) {
      throw new GeminiError("Keep the video under 15MB to avoid browser and API upload failures.");
    }
    if (!input.type.startsWith("video/")) throw new GeminiError("Please choose a video file.");

    this.onProgress("Reading the video…");
    const data = await fileToBase64(input, signal);
    let interaction = await this.request("interactions", key, signal, {
      method: "POST",
      body: JSON.stringify({
        model: GEMINI_MODEL,
        input: [
          { type: "video", mime_type: input.type || "video/mp4", data },
          { type: "text", text: buildGeminiPrompt(prompt) },
        ],
      }),
    });

    const id = String(interaction.id || interaction.name || "");
    if (!id && isPending(interaction)) throw new GeminiError("Gemini returned a task that cannot be polled.");

    for (let waited = 0; isPending(interaction); waited += 5) {
      if (waited >= 900) throw new GeminiError("Generation timed out. Try again later.", true);
      await delay(5000, signal);
      interaction = await this.request(`interactions/${encodeURIComponent(id)}`, key, signal);
      if (isFailed(interaction)) throw new GeminiError(this.readError(interaction));
      this.onProgress(`Generating AI video… ${waited + 5}s`);
    }
    if (isFailed(interaction)) throw new GeminiError(this.readError(interaction));

    const output = getOutputVideo(interaction);
    if (!output) throw new GeminiError("AI did not return a usable video.");
    return this.downloadOutput(output, key, signal);
  }

  private async downloadOutput(
    output: JsonObject,
    key: string,
    signal: AbortSignal,
  ): Promise<Blob> {
    const data = output.data;
    if (typeof data === "string") {
      const binary = atob(data);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      return new Blob([bytes], { type: String(output.mime_type || "video/mp4") });
    }

    let uri = String(output.uri || output.file_uri || output.url || "");
    if (!uri) throw new GeminiError("The video returned by AI is missing data or a URI.");
    const fileName = uri.includes("/files/")
      ? `files/${uri.split("/files/")[1]?.split(/[?#]/)[0] || ""}`
      : uri;

    if (!/^https?:\/\//.test(uri)) {
      for (let index = 0; index < 60; index += 1) {
        const file = await this.request(fileName, key, signal);
        if (
          String(file.state || "")
            .toUpperCase()
            .includes("ACTIVE")
        )
          break;
        if (
          String(file.state || "")
            .toUpperCase()
            .includes("FAILED")
        ) {
          throw new GeminiError("Gemini failed to process the output file.");
        }
        this.onProgress(`Waiting for the output file… ${index * 5}s`);
        await delay(5000, signal);
      }
      uri = `${GEMINI_BASE_URL}/${fileName}:download?alt=media`;
    }

    this.onProgress("Downloading the AI video…");
    const response = await fetch(uri, { headers: { "x-goog-api-key": key }, signal });
    if (!response.ok)
      throw new GeminiError(`Download failed: HTTP ${response.status}`, response.status >= 500);
    return response.blob();
  }

  private async request(
    path: string,
    key: string,
    signal: AbortSignal,
    init: RequestInit = {},
  ): Promise<JsonObject> {
    const response = await fetch(`${GEMINI_BASE_URL}/${path}`, {
      ...init,
      signal,
      headers: {
        "x-goog-api-key": key,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers || {}),
      },
    });
    if (!response.ok) {
      let detail = response.statusText;
      try {
        const payload = (await response.json()) as JsonObject;
        const error = payload.error;
        if (error && typeof error === "object")
          detail = String((error as JsonObject).message || detail);
      } catch {
        // Keep the HTTP status when the response is not JSON.
      }
      throw new GeminiError(
        `Gemini request failed: ${response.status} ${detail.slice(0, 180)}`,
        response.status >= 500,
      );
    }
    return (await response.json()) as JsonObject;
  }

  private readError(value: JsonObject): string {
    const error = value.error;
    if (error && typeof error === "object")
      return String((error as JsonObject).message || "Generation failed");
    return String(value.message || value.status || "Generation failed");
  }
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Request cancelled", "AbortError"));
      },
      { once: true },
    );
  });
}
