import {
  discoverWithBackoff,
  LAST_PORT_STORAGE_KEY,
  type ClientMessage,
  type ConversionRule,
  type ConversionUnit,
  type LedgerEntry,
  type OverlayStyle,
  type ServerMessage,
  type SubathonSession,
  type TimerSnapshot,
} from "@stream-drops/subathon-protocol";

type Listener = (message: ServerMessage) => void;

export class SubathonClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private abortController: AbortController | null = null;
  private overlayUrl: string | null = null;
  private port: number | null = null;

  getOverlayUrl() {
    return this.overlayUrl;
  }

  getPort() {
    return this.port;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(message: ServerMessage) {
    for (const listener of this.listeners) {
      listener(message);
    }
  }

  async connect(onAttempt?: (attempt: number) => void) {
    this.disconnect(false);
    this.abortController = new AbortController();

    const preferredPort = Number(
      localStorage.getItem(LAST_PORT_STORAGE_KEY) ?? "",
    );

    const discovery = await discoverWithBackoff({
      preferredPort: Number.isFinite(preferredPort) ? preferredPort : null,
      signal: this.abortController.signal,
      onAttempt,
    });

    if (!discovery) {
      throw new Error("SERVER_NOT_FOUND");
    }

    this.port = discovery.port;
    this.overlayUrl = discovery.overlayUrl;
    localStorage.setItem(LAST_PORT_STORAGE_KEY, String(discovery.port));

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(discovery.wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "hello", client: "front" }));
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as ServerMessage;
        this.emit(message);

        if (message.type === "hello.ok") {
          resolve();
        }
      };

      ws.onerror = () => reject(new Error("WS_ERROR"));
      ws.onclose = () => {
        this.emit({
          type: "connection.status",
          connected: false,
          eventsub: false,
        });
      };
    });
  }

  send(message: ClientMessage): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }

    return false;
  }

  disconnect(clear = true) {
    this.abortController?.abort();
    this.abortController = null;
    this.ws?.close();
    this.ws = null;

    if (clear) {
      this.overlayUrl = null;
      this.port = null;
    }
  }
}

export const subathonClient = new SubathonClient();

export type {
  ConversionRule,
  ConversionUnit,
  LedgerEntry,
  OverlayStyle,
  SubathonSession,
  TimerSnapshot,
};
