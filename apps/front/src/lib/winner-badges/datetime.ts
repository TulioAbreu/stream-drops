import type { CalendarDate } from "./types";

export type ZonedParts = CalendarDate & {
  hour: number;
  minute: number;
  second: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached) return cached;
  const created = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  formatters.set(timeZone, created);
  return created;
}

function readPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  const value = parts.find((part) => part.type === type)?.value;
  return value === undefined ? Number.NaN : Number(value);
}

/** Dia e hora civis no fuso. `null` se o instante ou o fuso forem inválidos. */
export function zonedParts(
  instant: number,
  timeZone: string,
): ZonedParts | null {
  if (!Number.isFinite(instant)) return null;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = formatterFor(timeZone).formatToParts(new Date(instant));
  } catch {
    return null;
  }
  let year = readPart(parts, "year");
  let month = readPart(parts, "month");
  let day = readPart(parts, "day");
  let hour = readPart(parts, "hour");
  const minute = readPart(parts, "minute");
  const second = readPart(parts, "second");
  if (
    ![year, month, day, hour, minute, second].every((value) =>
      Number.isFinite(value),
    )
  ) {
    return null;
  }
  if (hour === 24) {
    hour = 0;
    const next = addCalendarDays({ year, month, day }, 1);
    year = next.year;
    month = next.month;
    day = next.day;
  }
  return { year, month, day, hour, minute, second };
}

export function parseInstant(iso: string | undefined): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calendarFromInstant(
  instant: number,
  timeZone: string,
): CalendarDate | null {
  const parts = zonedParts(instant, timeZone);
  if (!parts) return null;
  return { year: parts.year, month: parts.month, day: parts.day };
}

export function calendarFromIso(
  iso: string | undefined,
  timeZone: string,
): CalendarDate | null {
  const instant = parseInstant(iso);
  if (instant === null) return null;
  return calendarFromInstant(instant, timeZone);
}

export function dateKey(date: CalendarDate): string {
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  return `${date.year}-${month}-${day}`;
}

export function monthKey(date: CalendarDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}`;
}

export function compareCalendar(a: CalendarDate, b: CalendarDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

export function addCalendarDays(
  date: CalendarDate,
  days: number,
): CalendarDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Soma meses-calendário com clamp (31/01 + 1 mês → 28 ou 29/02). */
export function addCalendarMonths(
  date: CalendarDate,
  months: number,
): CalendarDate {
  const shifted = date.month - 1 + months;
  const year = date.year + Math.floor(shifted / 12);
  const monthIndex = ((shifted % 12) + 12) % 12;
  const month = monthIndex + 1;
  return {
    year,
    month,
    day: Math.min(date.day, daysInMonth(year, month)),
  };
}

export function calendarDayIndex(date: CalendarDate): number {
  return Math.floor(Date.UTC(date.year, date.month - 1, date.day) / MS_PER_DAY);
}

function offsetMs(instant: number, timeZone: string): number | null {
  const parts = zonedParts(instant, timeZone);
  if (!parts) return null;
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const wholeSeconds = Math.floor(instant / 1000) * 1000;
  return asUtc - wholeSeconds;
}

/** Converte data/hora civil no fuso para um instante UTC. */
export function localDateTimeToUtc(
  value: ZonedParts & { millisecond?: number },
  timeZone: string,
): Date | null {
  const desired = Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    value.hour,
    value.minute,
    value.second,
    value.millisecond ?? 0,
  );
  const first = offsetMs(desired, timeZone);
  if (first === null) return null;
  let utc = desired - first;
  const second = offsetMs(utc, timeZone);
  if (second === null) return null;
  if (second !== first) utc = desired - second;
  return new Date(utc);
}

export function localDateTimeToIso(
  value: ZonedParts & { millisecond?: number },
  timeZone: string,
): string | null {
  return localDateTimeToUtc(value, timeZone)?.toISOString() ?? null;
}

/**
 * Fechamento do mês: 00:00 do dia 1 do mês seguinte, no fuso.
 * O rei de setembro existe a partir deste instante (D2).
 */
export function monthCloseIso(
  year: number,
  month: number,
  timeZone: string,
): string | null {
  const next = addCalendarMonths({ year, month, day: 1 }, 1);
  return localDateTimeToIso(
    { ...next, hour: 0, minute: 0, second: 0, millisecond: 0 },
    timeZone,
  );
}

export function sameCalendarMonth(a: CalendarDate, b: CalendarDate): boolean {
  return a.year === b.year && a.month === b.month;
}

export const DAY_MS = MS_PER_DAY;
