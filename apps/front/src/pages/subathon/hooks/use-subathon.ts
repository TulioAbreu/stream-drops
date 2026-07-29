import {
  createLocalTimerAnchor,
  formatTimerMs,
  interpolateLocalAnchor,
  type ConversionRule,
  type ConversionUnit,
  type LedgerEntry,
  type LocalTimerAnchor,
  type OverlayStyle,
  type SubathonSession,
  type TimerSnapshot,
} from "@stream-drops/subathon-protocol";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { useLoginStore } from "@/storage/login";
import { subathonClient } from "@/service/subathon/client";
import { useTranslation } from "@/i18n";
import { EVENTSUB_ENABLED_STORAGE_KEY } from "../utils";

export type SubathonContextValue = ReturnType<typeof useSubathonState>;

const SubathonContext = createContext<SubathonContextValue | null>(null);

function readEventsubPreference(): boolean {
  try {
    return localStorage.getItem(EVENTSUB_ENABLED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function useSubathonState() {
  const { t } = useTranslation();
  const { userData } = useTwitchApi();
  const token = useLoginStore((state) => state.twitchAccessToken);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [sessions, setSessions] = useState<SubathonSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<TimerSnapshot | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [eventsubEnabled, setEventsubEnabled] = useState(readEventsubPreference);
  const [eventsubConnected, setEventsubConnected] = useState(false);
  const [displayMs, setDisplayMs] = useState(0);
  const [lastCreatedSessionId, setLastCreatedSessionId] = useState<
    string | null
  >(null);
  const [errorNonce, setErrorNonce] = useState(0);
  const anchorRef = useRef<LocalTimerAnchor | null>(null);
  const eventsubEnabledRef = useRef(eventsubEnabled);
  eventsubEnabledRef.current = eventsubEnabled;

  const sendCommand = useCallback(
    (message: Parameters<typeof subathonClient.send>[0]) => {
      const sent = subathonClient.send(message);

      if (!sent) {
        toast.error(t("SUBATHON_ERROR_DISCONNECTED"));
      }

      return sent;
    },
    [t],
  );

  const refreshSessions = useCallback(() => {
    sendCommand({ type: "listSessions" });
  }, [sendCommand]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      await subathonClient.connect((nextAttempt) => setAttempt(nextAttempt));
      setConnected(true);
      setOverlayUrl(subathonClient.getOverlayUrl());
      sendCommand({ type: "listSessions" });

      if (token && userData?.id && userData.login) {
        sendCommand({
          type: "configureTwitch",
          accessToken: token,
          broadcasterUserId: userData.id,
          channelLogin: userData.login,
          enabled: eventsubEnabledRef.current,
          chatEnabled: true,
        });
      }
    } catch {
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  }, [sendCommand, token, userData?.id, userData?.login]);

  useEffect(() => {
    const unsubscribe = subathonClient.subscribe((message) => {
      if (message.type === "error") {
        setErrorNonce((current) => current + 1);
        toast.error(message.message || t("SUBATHON_ERROR_GENERIC"));
        return;
      }

      if (message.type === "sessions.list") {
        setSessions(message.sessions);
      }

      if (message.type === "session.created") {
        setLastCreatedSessionId(message.session.id);
        setSessions((current) => {
          if (current.some((item) => item.id === message.session.id)) {
            return current.map((item) =>
              item.id === message.session.id ? message.session : item,
            );
          }
          return [message.session, ...current];
        });
      }

      if (message.type === "session.updated") {
        setSessions((current) => {
          const exists = current.some((item) => item.id === message.session.id);
          if (!exists) {
            return [message.session, ...current];
          }

          return current.map((item) =>
            item.id === message.session.id ? message.session : item,
          );
        });
      }

      if (message.type === "session.deleted") {
        setSessions((current) =>
          current.filter((item) => item.id !== message.sessionId),
        );
        setActiveSessionId((current) =>
          current === message.sessionId ? null : current,
        );
        setEntries((current) =>
          current.filter((item) => item.sessionId !== message.sessionId),
        );
      }

      if (message.type === "timer.snapshot") {
        anchorRef.current = createLocalTimerAnchor(message.snapshot);
        setSnapshot(message.snapshot);
        setDisplayMs(interpolateLocalAnchor(anchorRef.current));
        setActiveSessionId(message.snapshot.sessionId);
      }

      if (message.type === "ledger.list") {
        setEntries(message.entries);
      }

      if (message.type === "ledger.entry") {
        setEntries((current) => {
          let next = current;

          if (
            message.entry.type === "undo" &&
            message.entry.undoOfEntryId
          ) {
            next = next.map((item) =>
              item.id === message.entry.undoOfEntryId
                ? { ...item, undoneByEntryId: message.entry.id }
                : item,
            );
          }

          if (next.some((item) => item.id === message.entry.id)) {
            return next;
          }

          return [message.entry, ...next];
        });
      }

      if (message.type === "hello.ok") {
        setActiveSessionId(message.activeSessionId);
        if (message.activeSessionId) {
          subathonClient.send({
            type: "ledger.list",
            sessionId: message.activeSessionId,
            limit: 100,
          });
        } else {
          setEntries([]);
        }
      }

      if (message.type === "connection.status") {
        setConnected(message.connected);
        setEventsubConnected(message.eventsub);
      }
    });

    void connect();

    return () => {
      unsubscribe();
      subathonClient.disconnect();
    };
  }, [connect, t]);

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

  const createSession = useCallback(
    (
      name: string,
      initialMs: number,
      rules: ConversionRule[],
      activate = true,
    ) => {
      setLastCreatedSessionId(null);
      return sendCommand({
        type: "createSession",
        name,
        initialMs,
        rules,
        activate,
      });
    },
    [sendCommand],
  );

  const loadEntries = useCallback(
    (sessionId: string) => {
      sendCommand({ type: "ledger.list", sessionId, limit: 100 });
    },
    [sendCommand],
  );

  const setActiveSession = useCallback(
    (sessionId: string | null) => {
      const sent = sendCommand({ type: "setActiveSession", sessionId });
      if (!sent) {
        return false;
      }

      setActiveSessionId(sessionId);
      if (sessionId) {
        loadEntries(sessionId);
      } else {
        setEntries([]);
      }

      return true;
    },
    [loadEntries, sendCommand],
  );

  const renameSession = useCallback(
    (sessionId: string, name: string) =>
      sendCommand({ type: "renameSession", sessionId, name }),
    [sendCommand],
  );

  const deleteSession = useCallback(
    (sessionId: string) => sendCommand({ type: "deleteSession", sessionId }),
    [sendCommand],
  );

  const updateConversion = useCallback(
    (sessionId: string, rules: ConversionRule[]) =>
      sendCommand({ type: "updateConversion", sessionId, rules }),
    [sendCommand],
  );

  const updateStyle = useCallback(
    (sessionId: string, style: OverlayStyle) =>
      sendCommand({ type: "updateStyle", sessionId, style }),
    [sendCommand],
  );

  const play = useCallback(
    () => sendCommand({ type: "timer.play" }),
    [sendCommand],
  );
  const pause = useCallback(
    () => sendCommand({ type: "timer.pause" }),
    [sendCommand],
  );
  const reset = useCallback(
    (initialMs: number) =>
      sendCommand({ type: "timer.reset", initialMs }),
    [sendCommand],
  );

  const addCredit = useCallback(
    (unit: ConversionUnit, amount: number) => {
      return sendCommand({
        type: "ledger.add",
        unit,
        amount,
        actor: userData?.displayName ?? userData?.login ?? "streamer",
      });
    },
    [sendCommand, userData?.displayName, userData?.login],
  );

  const undoEntry = useCallback(
    (entryId: string) => {
      return sendCommand({
        type: "ledger.undo",
        entryId,
        actor: userData?.displayName ?? userData?.login ?? "streamer",
      });
    },
    [sendCommand, userData?.displayName, userData?.login],
  );

  const addMinutes = useCallback(
    (minutes: number) => {
      return sendCommand({
        type: "timer.addMinutes",
        minutes,
        actor: userData?.displayName ?? userData?.login ?? "streamer",
      });
    },
    [sendCommand, userData?.displayName, userData?.login],
  );

  const setRemaining = useCallback(
    (remainingMs: number) => {
      return sendCommand({
        type: "timer.setRemaining",
        remainingMs,
        actor: userData?.displayName ?? userData?.login ?? "streamer",
      });
    },
    [sendCommand, userData?.displayName, userData?.login],
  );

  const toggleEventsub = useCallback(
    (enabled: boolean) => {
      setEventsubEnabled(enabled);
      try {
        localStorage.setItem(
          EVENTSUB_ENABLED_STORAGE_KEY,
          enabled ? "true" : "false",
        );
      } catch {
        // ignore storage failures
      }

      if (token && userData?.id && userData.login) {
        sendCommand({
          type: "configureTwitch",
          accessToken: token,
          broadcasterUserId: userData.id,
          channelLogin: userData.login,
          enabled,
          chatEnabled: true,
        });
      }
    },
    [sendCommand, token, userData?.id, userData?.login],
  );

  const clearLastCreatedSessionId = useCallback(() => {
    setLastCreatedSessionId(null);
  }, []);

  const activeSession = sessions.find((item) => item.id === activeSessionId);

  return {
    connected,
    connecting,
    attempt,
    connect,
    sessions,
    activeSession,
    activeSessionId,
    snapshot,
    displayMs,
    formattedTime: formatTimerMs(displayMs),
    entries,
    overlayUrl,
    eventsubEnabled,
    eventsubConnected,
    lastCreatedSessionId,
    errorNonce,
    clearLastCreatedSessionId,
    createSession,
    setActiveSession,
    renameSession,
    deleteSession,
    updateConversion,
    updateStyle,
    play,
    pause,
    reset,
    addCredit,
    undoEntry,
    loadEntries,
    addMinutes,
    setRemaining,
    toggleEventsub,
    refreshSessions,
  };
}

export function SubathonProvider({ children }: { children: ReactNode }) {
  const value = useSubathonState();
  return createElement(SubathonContext.Provider, { value }, children);
}

export function useSubathon() {
  const context = useContext(SubathonContext);
  if (!context) {
    throw new Error("useSubathon must be used within SubathonProvider");
  }
  return context;
}

export function useOptionalSubathon() {
  return useContext(SubathonContext);
}
