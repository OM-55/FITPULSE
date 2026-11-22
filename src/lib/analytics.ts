import type { DailyLog, MealCompletion, WorkoutCompletion } from '../types/database'
import { addDaysISO } from './date'

export interface StreakResult {
  currentStreak: number
  longestStreak: number
}

export interface DaySummary {
  date: string
  workoutCompleted: number
  workoutTotal: number
  workoutIsRest: boolean
  workoutStatus: 'completed' | 'partial' | 'missed' | 'rest' | 'unscheduled' | 'future'
  mealsCompleted: number
  mealsTotal: number
  calories: number
  protein: number
}

/**
 * Streak logic (documented in UI and README):
 * - A training day counts toward a streak if at least 1 scheduled exercise was completed on that date.
 * - Designated rest days (or days outside a 5/6-day plan) do NOT break a streak and do NOT add to the count.
 * - Today only breaks a streak if yesterday was missed; an unfinished workout today keeps the streak alive through yesterday.
 * - Future dates are never counted as missed.
 */
export function computeDaySummaries(
  dates: string[],
  todayISO: string,
  logs: DailyLog[],
  wComps: WorkoutCompletion[],
  mComps: MealCompletion[]
): DaySummary[] {
  const logMap = new Map<string, DailyLog>()
  logs.forEach((l) => logMap.set(l.log_date, l))

  const wByDate = new Map<string, WorkoutCompletion[]>()
  wComps.forEach((c) => {
    const arr = wByDate.get(c.scheduled_date) || []
    arr.push(c)
    wByDate.set(c.scheduled_date, arr)
  })

  const mByDate = new Map<string, MealCompletion[]>()
  mComps.forEach((c) => {
    const arr = mByDate.get(c.scheduled_date) || []
    arr.push(c)
    mByDate.set(c.scheduled_date, arr)
  })

  return dates.map((date) => {
    const log = logMap.get(date)
    const ws = wByDate.get(date) || []
    const ms = mByDate.get(date) || []

    const workoutTotal = ws.length
    const workoutCompleted = ws.filter((x) => x.completed).length
    const mealsTotal = ms.length
    const mealsCompleted = ms.filter((x) => x.completed).length
    const workoutIsRest = log?.workout_is_rest === true

    let workoutStatus: DaySummary['workoutStatus'] = 'unscheduled'
    if (date > todayISO) {
      workoutStatus = 'future'
    } else if (workoutIsRest && workoutTotal === 0) {
      workoutStatus = 'rest'
    } else if (workoutTotal > 0) {
      if (workoutCompleted === workoutTotal) workoutStatus = 'completed'
      else if (workoutCompleted > 0) workoutStatus = 'partial'
      else workoutStatus = date === todayISO ? 'unscheduled' : 'missed'
    } else if (log?.workout_plan_id) {
      workoutStatus = 'rest'
    }

    const calories = ms
      .filter((m) => m.completed)
      .reduce((acc, m) => acc + (Number(m.total_calories) || 0), 0)
    const protein = ms
      .filter((m) => m.completed)
      .reduce((acc, m) => acc + (Number(m.total_protein) || 0), 0)

    return {
      date,
      workoutCompleted,
      workoutTotal,
      workoutIsRest,
      workoutStatus,
      mealsCompleted,
      mealsTotal,
      calories: Math.round(calories),
      protein: Math.round(protein),
    }
  })
}

export function computeStreaks(
  todayISO: string,
  logs: DailyLog[],
  wComps: WorkoutCompletion[]
): StreakResult {
  const completedDates = new Set<string>()
  const scheduledDates = new Set<string>()
  wComps.forEach((c) => {
    if (c.scheduled_date <= todayISO) {
      scheduledDates.add(c.scheduled_date)
      if (c.completed) completedDates.add(c.scheduled_date)
    }
  })

  const restDates = new Set<string>()
  logs.forEach((l) => {
    if (l.log_date <= todayISO && l.workout_is_rest === true && !scheduledDates.has(l.log_date)) {
      restDates.add(l.log_date)
    }
  })

  if (completedDates.size === 0) {
    return { currentStreak: 0, longestStreak: 0 }
  }

  // Find earliest date we have records for
  const allDates = [...completedDates, ...scheduledDates, ...restDates].sort()
  const earliest = allDates[0]

  // Longest streak forward scan
  let longest = 0
  let running = 0
  let cursor = earliest
  while (cursor <= todayISO) {
    if (completedDates.has(cursor)) {
      running++
      if (running > longest) longest = running
    } else if (restDates.has(cursor)) {
      // Rest days preserve streak without incrementing
    } else if (cursor < todayISO) {
      running = 0
    }
    cursor = addDaysISO(cursor, 1)
  }

  // Current streak backward scan from today
  let current = 0
  let back = todayISO
  if (completedDates.has(todayISO)) {
    current++
    back = addDaysISO(todayISO, -1)
  } else {
    // Today isn't over yet; check starting yesterday
    back = addDaysISO(todayISO, -1)
  }

  while (back >= earliest) {
    if (completedDates.has(back)) {
      current++
    } else if (restDates.has(back)) {
      // Rest days preserve streak
    } else {
      break
    }
    back = addDaysISO(back, -1)
  }

  return { currentStreak: current, longestStreak: Math.max(longest, current) }
}
