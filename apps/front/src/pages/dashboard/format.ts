import { calendarFromIso } from "@/lib/winner-badges/datetime";
import type { EngineClock } from "@/lib/winner-badges/types";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const MONTH_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  timeZone: "UTC",
});

export function monthName(month: number): string {
  if (month < 1 || month > 12) return "";
  return MONTH_FORMAT.format(new Date(Date.UTC(2026, month - 1, 1)));
}

export function currentMonthName(clock: EngineClock): string {
  const today = calendarFromIso(clock.now, clock.timeZone);
  if (!today) return "";
  return monthName(today.month);
}

export function currentYear(clock: EngineClock): number | null {
  return calendarFromIso(clock.now, clock.timeZone)?.year ?? null;
}

export function formatRelative(iso: string, nowIso: string): string {
  const target = Date.parse(iso);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(target) || !Number.isFinite(now)) return "";
  const diff = target - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  if (abs < MINUTE) return rtf.format(Math.round(diff / SECOND), "second");
  if (abs < HOUR) return rtf.format(Math.round(diff / MINUTE), "minute");
  if (abs < DAY) return rtf.format(Math.round(diff / HOUR), "hour");
  if (abs < 30 * DAY) return rtf.format(Math.round(diff / DAY), "day");
  if (abs < 365 * DAY) return rtf.format(Math.round(diff / (30 * DAY)), "month");
  return rtf.format(Math.round(diff / (365 * DAY)), "year");
}

export function formatAbsolute(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "short",
    timeStyle: "short",
  };
  try {
    return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "UTC" }).format(date);
  }
}

export function placeLabel(position: number): string {
  return `${position}º`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((part) => part.length > 0);
  const letters = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase());
  const text = letters.join("");
  return text.length > 0 ? text : "?";
}
