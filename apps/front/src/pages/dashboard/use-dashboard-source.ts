import { useEffect, useRef, useState } from "react";
import { readDashboardSource, type DashboardSource } from "./source";

export type DashboardLoadStatus = "loading" | "ready" | "error";

/**
 * Lê o histórico uma vez ao montar e de novo quando a aba volta a ficar visível.
 * As duas leituras são somente leitura. Não grava preferência nem sorteio.
 */
export function useDashboardSource(
  loadSource: () => Promise<DashboardSource> = readDashboardSource,
): { status: DashboardLoadStatus; source: DashboardSource | null } {
  const loadRef = useRef(loadSource);
  loadRef.current = loadSource;
  const [status, setStatus] = useState<DashboardLoadStatus>("loading");
  const [source, setSource] = useState<DashboardSource | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loadRef.current().then(
      (value) => {
        if (cancelled) return;
        setSource(value);
        setStatus("ready");
      },
      () => {
        if (!cancelled) setStatus("error");
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      void loadRef.current().then(
        (value) => {
          setSource(value);
          setStatus("ready");
        },
        () => {
          /* a tela fica com a leitura anterior */
        },
      );
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return { status, source };
}
