/**
 * Business-day math over the vendored ANBIMA calendar.
 *
 * Holidays come exclusively from `shared/anbima-calendar.json` — a committed,
 * reviewed snapshot of the ANBIMA calendar (see plan 02-01). No algorithmic or
 * third-party holiday-computing package may ever be introduced here (C-03):
 * a system that silently answers from a different calendar than the one that
 * was reviewed and committed is worse than one that refuses to answer.
 *
 * This module implements the exact same reference algorithm as
 * `cli/apollo_cli/bizdays.py` — see plan 02-02's <interfaces> block for the
 * shared specification. The two implementations must never be allowed to
 * disagree silently; `shared/bizdays.testcases.json` is the single source of
 * test data proving they don't.
 */

import calendar from "../../../shared/anbima-calendar.json";

export const CALENDAR_START: string = calendar.start;
export const CALENDAR_END: string = calendar.end;

const HOLIDAYS: ReadonlySet<string> = new Set(calendar.holidays);

export class InvalidDateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDateError";
  }
}

export class CalendarRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarRangeError";
  }
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse and validate an ISO `YYYY-MM-DD` date string, rejecting malformed or
 * non-existent calendar dates. Does NOT check the vendored calendar range —
 * see `assertInRange`.
 */
function parseIsoDate(date: string): { iso: string; utcMillis: number } {
  if (typeof date !== "string" || !ISO_DATE_RE.test(date)) {
    throw new InvalidDateError(`Invalid date format: ${JSON.stringify(date)}`);
  }

  const [yearStr, monthStr, dayStr] = date.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const utcMillis = Date.UTC(year, month - 1, day);
  const rebuilt = new Date(utcMillis);

  if (
    rebuilt.getUTCFullYear() !== year ||
    rebuilt.getUTCMonth() !== month - 1 ||
    rebuilt.getUTCDate() !== day
  ) {
    throw new InvalidDateError(`Invalid calendar date: ${JSON.stringify(date)}`);
  }

  return { iso: date, utcMillis };
}

/**
 * Assert that an already-parsed ISO date string falls within
 * `[CALENDAR_START, CALENDAR_END]` (inclusive on both ends). Plain
 * lexicographic string comparison is correct here because all dates are
 * zero-padded ISO strings.
 */
function assertInRange(iso: string): void {
  if (iso < CALENDAR_START || iso > CALENDAR_END) {
    throw new CalendarRangeError(
      `Date ${iso} is outside the vendored calendar range [${CALENDAR_START}, ${CALENDAR_END}]`,
    );
  }
}

export function isBusinessDay(date: string): boolean {
  const { iso, utcMillis } = parseIsoDate(date);
  assertInRange(iso);

  const dayOfWeek = new Date(utcMillis).getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  return !HOLIDAYS.has(iso);
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function formatIso(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

export function addBusinessDays(date: string, n: number): string {
  const { iso, utcMillis } = parseIsoDate(date);
  assertInRange(iso);

  if (n === 0) {
    return iso;
  }

  const step = n > 0 ? 1 : -1;
  let remaining = Math.abs(n);
  const cursor = new Date(utcMillis);

  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + step);
    const cursorIso = formatIso(
      cursor.getUTCFullYear(),
      cursor.getUTCMonth() + 1,
      cursor.getUTCDate(),
    );
    assertInRange(cursorIso);

    if (isBusinessDay(cursorIso)) {
      remaining -= 1;
    }
  }

  return formatIso(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate());
}

/**
 * Strictly-after semantics: a date that is already a business day still
 * advances. Deliberately NOT `bizdays`' `Calendar.following()`
 * same-day-passthrough behavior — see plan 02-02's backstop truth.
 */
export function nextBusinessDay(date: string): string {
  return addBusinessDays(date, 1);
}
