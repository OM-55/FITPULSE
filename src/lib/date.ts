import { WEEKDAYS } from './constants'

/** Returns YYYY-MM-DD for `date` in the given IANA timezone. */
export function formatDateInTz(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)
    const y = parts.find((p) => p.type === 'year')?.value ?? '2026'
    const m = parts.find((p) => p.type === 'month')?.value ?? '01'
    const d = parts.find((p) => p.type === 'day')?.value ?? '01'
    return `${y}-${m}-${d}`
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

/** Returns current hour (0-23) in the user's timezone. */
export function getCurrentHourInTz(timeZone: string): number {
  try {
    const h = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    }).format(new Date())
    return parseInt(h, 10) % 24
  } catch {
    return new Date().getHours()
  }
}

/** Parses YYYY-MM-DD as a UTC midday Date to avoid DST / local-offset shifts. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

/** Shifts a YYYY-MM-DD date string by `deltaDays`. */
export function addDaysISO(iso: string, deltaDays: number): string {
  const dt = parseISODate(iso)
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

/** Monday = 0 ... Sunday = 6 for a YYYY-MM-DD date string. */
export function weekdayIndexFromISO(iso: string): number {
  const dow = parseISODate(iso).getUTCDay()
  return dow === 0 ? 6 : dow - 1
}

export function weekdayNameFromISO(iso: string): string {
  return WEEKDAYS[weekdayIndexFromISO(iso)]
}

/** Pretty display date like "Sunday, Nov 22, 2026" from YYYY-MM-DD. */
export function formatPrettyDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parseISODate(iso))
}

export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  }).format(parseISODate(iso))
}

/** Returns the Monday..Sunday YYYY-MM-DD array for the week containing `iso`. */
export function getWeekDatesISO(iso: string): string[] {
  const wd = weekdayIndexFromISO(iso)
  const monday = addDaysISO(iso, -wd)
  return Array.from({ length: 7 }, (_, i) => addDaysISO(monday, i))
}

/** Format HH:MM(:SS) time string cleanly. */
export function formatTime12h(timeStr: string | null): string {
  if (!timeStr) return ''
  const [hh, mm] = timeStr.split(':').map(Number)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return timeStr
  const suffix = hh >= 12 ? 'PM' : 'AM'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${h12}:${String(mm).padStart(2, '0')} ${suffix}`
}

/** Weight unit label based on user preference. */
export function weightUnit(units: 'metric' | 'imperial' | undefined): 'kg' | 'lb' {
  return units === 'imperial' ? 'lb' : 'kg'
}
