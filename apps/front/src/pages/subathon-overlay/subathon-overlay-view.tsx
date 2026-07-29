import {
  createLocalTimerAnchor,
  discoverWithBackoff,
  formatTimerMs,
  interpolateLocalAnchor,
  LAST_PORT_STORAGE_KEY,
  type LocalTimerAnchor,
  type OverlayStyle,
  type ServerMessage,
  type TimerSnapshot,
} from "@stream-drops/subathon-protocol";
import { useEffect, useMemo, useRef, useState } from "react";

type ConnectionState = "discovering" | "connected" | "disconnected" | "syncing";

function applyStyle(style: OverlayStyle | undefined) {
  const root = document.documentElement;
  root.style.setProperty("--subathon-font", style?.fontFamily ?? "monospace");
  root.style.setProperty("--subathon-text", style?.textColor ?? "#ffffff");
  root.style.setProperty(
    "--subathon-bg",
    style?.gradient ?? style?.backgroundColor ?? "transparent",
  );
  root.style.setProperty(
    "--subathon-blur",
    `${style?.backdropBlur ?? 0}px`,
  );

  let custom = document.getElementById("subathon-custom-css");
  if (!custom) {
    custom = document.createElement("style");
    custom.id = "subathon-custom-css";
    document.head.appendChild(custom);
  }

  custom.textContent = style?.customCss ?? "";
}

export function SubathonOverlayView() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("discovering");
  const [snapshot, setSnapshot] = useState<TimerSnapshot | null>(null);
  const [style, setStyle] = useState<OverlayStyle | undefined>();
  const [displayMs, setDisplayMs] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hadSnapshotRef = useRef(false);
  const anchorRef = useRef<LocalTimerAnchor | null>(null);

  const preferredPort = useMemo(() => {
    const cached = localStorage.getItem(LAST_PORT_STORAGE_KEY);
    return cached ? Number(cached) : null;
  }, []);

  useEffect(() => {
    applyStyle(style);
  }, [style]);

  useEffect(() => {
    const tick = () => {
      const anchor = anchorRef.current;
      if (!anchor) {
        return;
      }
      setDisplayMs(interpolateLocalAnchor(anchor));
    };

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setConnectionState(hadSnapshotRef.current ? "syncing" : "discovering");

      const discovery = await discoverWithBackoff({
        preferredPort,
        signal: controller.signal,
        onAttempt: () => {
          if (!cancelled && !hadSnapshotRef.current) {
            setConnectionState("discovering");
          }
        },
      });

      if (cancelled || !discovery) {
        if (!cancelled) {
          setConnectionState("disconnected");
          setTimeout(connect, 2000);
        }
        return;
      }

      localStorage.setItem(
        LAST_PORT_STORAGE_KEY,
        String(discovery.port),
      );

      const ws = new WebSocket(discovery.wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "hello", client: "overlay" }));
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as ServerMessage;

        if (message.type === "timer.snapshot") {
          anchorRef.current = createLocalTimerAnchor(message.snapshot);
          setSnapshot(message.snapshot);
          setDisplayMs(interpolateLocalAnchor(anchorRef.current));
          hadSnapshotRef.current = true;
          setConnectionState("syncing");
          setTimeout(() => setConnectionState("connected"), 2000);
        }

        if (message.type === "session.updated") {
          setStyle(message.session.style);
        }
      };

      ws.onclose = () => {
        setConnectionState("disconnected");
        if (!cancelled) {
          setTimeout(connect, 1500);
        }
      };

      ws.onerror = () => {
        setConnectionState("disconnected");
      };
    };

    void connect();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
      wsRef.current?.close();
    };
  }, [preferredPort]);

  if (connectionState === "discovering" && !snapshot) {
    return (
      <div className="subathon-overlay-root">
        <div className="subathon-overlay-waiting">Aguardando servidor...</div>
      </div>
    );
  }

  return (
    <div className="subathon-overlay-root">
      <div className="subathon-overlay-status">
        {connectionState === "disconnected" ? (
          <span
            className="subathon-status-dot subathon-status-dot-disconnected"
            title="Desconectado"
          />
        ) : null}
        {connectionState === "syncing" ? (
          <span
            className="subathon-status-dot subathon-status-dot-syncing"
            title="Sincronizando"
          />
        ) : null}
        {connectionState === "connected" ? (
          <span
            className="subathon-status-dot subathon-status-dot-connected"
            title="Conectado"
          />
        ) : null}
      </div>
      <div className="subathon-overlay-timer">{formatTimerMs(displayMs)}</div>
    </div>
  );
}
