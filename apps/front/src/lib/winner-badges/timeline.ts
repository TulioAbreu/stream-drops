import {
  addCalendarDays,
  addCalendarMonths,
  calendarFromIso,
  compareCalendar,
  dateKey,
} from "./datetime";
import { hasWonAt, sameWin } from "./order";
import type { CalendarDate, WinEvent } from "./types";

/** Dias corridos terminando na última vitória do prefixo. */
export function consecutiveStreak(
  prefixEndingAtW: readonly WinEvent[],
  timeZone: string,
): number {
  const win = prefixEndingAtW[prefixEndingAtW.length - 1];
  if (!win) return 0;
  const day = calendarFromIso(win.wonAt, timeZone);
  if (!day) return 0;
  const days = new Set<string>();
  for (const event of prefixEndingAtW) {
    const eventDay = calendarFromIso(event.wonAt, timeZone);
    if (eventDay) days.add(dateKey(eventDay));
  }
  let cursor = day;
  let length = 0;
  while (days.has(dateKey(cursor))) {
    length += 1;
    cursor = addCalendarDays(cursor, -1);
    if (length > 4000) break;
  }
  return length;
}

export function previousDatedWin(
  prefix: readonly WinEvent[],
  win: WinEvent,
): WinEvent | undefined {
  for (let index = prefix.length - 1; index >= 0; index -= 1) {
    const event = prefix[index];
    if (!event || sameWin(event, win) || !hasWonAt(event)) continue;
    return event;
  }
  return undefined;
}

export function calendarGapAtLeast(
  previous: CalendarDate,
  current: CalendarDate,
  months: number,
): boolean {
  return compareCalendar(current, addCalendarMonths(previous, months)) >= 0;
}
