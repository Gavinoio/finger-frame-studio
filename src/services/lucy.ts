import { DECART_SDK_URL } from "../config";
import type { AIProvider, ProviderStatus } from "../types";

type LucyClient = {
  set: (value: { prompt: string | { text: string }; enhance: boolean }) => Promise<void>;
  disconnect?: () => Promise<void>;
  close?: () => void;
};

type DecartModule = {
  createDecartClient: (options: { apiKey: string }) => {
    realtime: {
      connect: (
        stream: MediaStream,
        options: {
          model: unknown;
          initialState: { prompt: { text: string; enhance: boolean } };
          onRemoteStream: (stream: MediaStream) => void;
        },
      ) => Promise<LucyClient>;
    };
  };
  models: { realtime: (name: string) => unknown };
};

export class LucyProvider implements AIProvider {
  private status: ProviderStatus = "idle";
  private client: LucyClient | null = null;
  private connectionToken = 0;
  private promptQueue = Promise.resolve();

  constructor(
    private readonly apiKey: () => string,
    private readonly getInputStream: () => MediaStream | null,
    private readonly onRemoteStream: (stream: MediaStream) => void,
    private readonly onStatus: (status: ProviderStatus, message: string) => void,
  ) {}

  getStatus(): ProviderStatus {
    return this.status;
  }

  async connect(): Promise<void> {
    const key = this.apiKey().trim();
    const stream = this.getInputStream();
    if (!key) throw new Error("Enter a Decart API key first.");
    if (!stream) throw new Error("The camera is not ready yet.");

    await this.disconnect();
    const token = ++this.connectionToken;
    this.setStatus("connecting", "Connecting to Lucy…");
    try {
      const module = (await import(/* @vite-ignore */ DECART_SDK_URL)) as DecartModule;
      const client = module.createDecartClient({ apiKey: key });
      const prompt =
        "Change the style of the video to a 3D animated movie with stylized CGI animation.";
      const connected = await client.realtime.connect(stream, {
        model: module.models.realtime("lucy-2.5"),
        initialState: { prompt: { text: prompt, enhance: true } },
        onRemoteStream: (remoteStream) => {
          if (token !== this.connectionToken) return;
          this.onRemoteStream(remoteStream);
          this.setStatus("live", "LIVE");
        },
      });
      if (token !== this.connectionToken) {
        await connected.disconnect?.();
        connected.close?.();
        return;
      }
      this.client = connected;
    } catch (error) {
      if (token !== this.connectionToken) return;
      this.setStatus(
        "error",
        `AI offline: ${error instanceof Error ? error.message : "Connection failed"}`,
      );
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connectionToken += 1;
    const client = this.client;
    this.client = null;
    try {
      await client?.disconnect?.();
      client?.close?.();
    } finally {
      this.setStatus("idle", "");
    }
  }

  updatePrompt(prompt: string): Promise<void> {
    this.promptQueue = this.promptQueue
      .catch(() => undefined)
      .then(async () => {
        if (!this.client) return;
        try {
          await this.client.set({ prompt: { text: prompt }, enhance: true });
        } catch {
          await this.client?.set({ prompt, enhance: true });
        }
      });
    return this.promptQueue;
  }

  private setStatus(status: ProviderStatus, message: string): void {
    this.status = status;
    this.onStatus(status, message);
  }
}
