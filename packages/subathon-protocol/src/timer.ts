import type { TimerSnapshot, TimerStatus } from "./types";

export function computeRemainingMs(
  status: TimerStatus,
  remainingMs: number,
  statusChangedAt: string,
  now: Date = new Date(),
): number {
  if (status === "ended") {
    return 0;
  }

  if (status !== "running") {
    return Math.max(0, remainingMs);
  }

  const elapsed = now.getTime() - new Date(statusChangedAt).getTime();
  return Math.max(0, remainingMs - elapsed);
}

export function formatTimerMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [
      String(hours).padStart(2, "0"),
      String(minutes).padStart(2, "0"),
      String(seconds).padStart(2, "0"),
    ].join(":");
  }

  return [
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":");
}

export interface LocalTimerAnchor {
  status: TimerStatus;
  remainingMs: number;
  receivedAtMs: number;
}

/** Cria âncora local monotônica a partir de um snapshot normalizado do server. */
export function createLocalTimerAnchor(
  snapshot: TimerSnapshot,
  receivedAtMs: number = performance.now(),
): LocalTimerAnchor {
  return {
    status: snapshot.status,
    remainingMs: snapshot.remainingMs,
    receivedAtMs,
  };
}

export function interpolateLocalAnchor(
  anchor: LocalTimerAnchor,
  nowMs: number = performance.now(),
): number {
  if (anchor.status === "ended") {
    return 0;
  }

  if (anchor.status !== "running") {
    return Math.max(0, anchor.remainingMs);
  }

  const elapsed = nowMs - anchor.receivedAtMs;
  return Math.max(0, anchor.remainingMs - elapsed);
}

export function interpolateSnapshot(
  snapshot: TimerSnapshot,
  now: Date = new Date(),
): number {
  return computeRemainingMs(
    snapshot.status,
    snapshot.remainingMs,
    snapshot.statusChangedAt,
    now,
  );
}
