export const PROTOCOL_VERSION = 3;

export const DEFAULT_HOST = "127.0.0.1";

export const PORT_RANGE_START = 8080;

export const PORT_RANGE_END = 8090;

export const PORT_RANGE = Array.from(
  { length: PORT_RANGE_END - PORT_RANGE_START + 1 },
  (_, index) => PORT_RANGE_START + index,
);

export const WS_PATH = "/ws";

export const DISCOVERY_TIMEOUT_MS = 400;

export const RECONNECT_BACKOFF_MS = [1000, 2000, 5000, 10000] as const;

export const LAST_PORT_STORAGE_KEY = "stream-drops-subathon-last-port";
