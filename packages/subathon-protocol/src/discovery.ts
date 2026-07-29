import {
  DEFAULT_HOST,
  DISCOVERY_TIMEOUT_MS,
  PORT_RANGE,
  PROTOCOL_VERSION,
  WS_PATH,
} from "./constants";
import type { ClientMessage, ServerMessage } from "./types";

export interface DiscoverOptions {
  host?: string;
  ports?: number[];
  preferredPort?: number | null;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface DiscoveryResult {
  host: string;
  port: number;
  wsUrl: string;
  overlayUrl: string;
  hello: Extract<ServerMessage, { type: "hello.ok" }>;
}

function buildWsUrl(host: string, port: number): string {
  return `ws://${host}:${port}${WS_PATH}`;
}

function buildOverlayUrl(host: string, port: number): string {
  return `http://${host}:${port}/overlay`;
}

function tryPort(
  host: string,
  port: number,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<DiscoveryResult | null> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(null);
      return;
    }

    const wsUrl = buildWsUrl(host, port);
    let settled = false;

    const finish = (result: DiscoveryResult | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      try {
        ws.close();
      } catch {
        // ignore
      }
      resolve(result);
    };

    const onAbort = () => finish(null);

    const ws = new WebSocket(wsUrl);
    const hello: ClientMessage = { type: "hello", client: "unknown" };

    const timeout = setTimeout(() => finish(null), timeoutMs);

    signal?.addEventListener("abort", onAbort);

    ws.onopen = () => {
      ws.send(JSON.stringify(hello));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as ServerMessage;
        if (
          message.type === "hello.ok" &&
          message.protocolVersion === PROTOCOL_VERSION
        ) {
          finish({
            host,
            port,
            wsUrl,
            overlayUrl: buildOverlayUrl(host, port),
            hello: message,
          });
        }
      } catch {
        finish(null);
      }
    };

    ws.onerror = () => finish(null);
    ws.onclose = () => finish(null);
  });
}

export async function discoverSubathonServer(
  options: DiscoverOptions = {},
): Promise<DiscoveryResult | null> {
  const host = options.host ?? DEFAULT_HOST;
  const timeoutMs = options.timeoutMs ?? DISCOVERY_TIMEOUT_MS;
  const ports = options.ports ?? PORT_RANGE;

  const orderedPorts = options.preferredPort
    ? [
        options.preferredPort,
        ...ports.filter((port) => port !== options.preferredPort),
      ]
    : ports;

  for (const port of orderedPorts) {
    if (options.signal?.aborted) {
      return null;
    }

    const result = await tryPort(host, port, timeoutMs, options.signal);
    if (result) {
      return result;
    }
  }

  return null;
}

export async function discoverWithBackoff(
  options: DiscoverOptions & {
    onAttempt?: (attempt: number) => void;
    backoffMs?: readonly number[];
  } = {},
): Promise<DiscoveryResult | null> {
  const backoff = options.backoffMs ?? [1000, 2000, 5000, 10000];
  let attempt = 0;

  while (!options.signal?.aborted) {
    options.onAttempt?.(attempt);
    const result = await discoverSubathonServer(options);
    if (result) {
      return result;
    }

    const delay = backoff[Math.min(attempt, backoff.length - 1)] ?? 10000;
    attempt += 1;

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delay);
      options.signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new Error("aborted"));
        },
        { once: true },
      );
    }).catch(() => null);

    if (options.signal?.aborted) {
      return null;
    }
  }

  return null;
}
