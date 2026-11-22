export const APP_NAME = 'FitPulse'
export const APP_TAGLINE = 'Plan. Track. Stay Consistent.'
export const APP_DESCRIPTION = 'Plan recurring weekly workouts and diets, track daily checklists, and measure your consistency.'

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
export type Weekday = (typeof WEEKDAYS)[number]

export const DIFFICULTY_LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number]

export const PLAN_DURATIONS = [5, 6, 7] as const
export type PlanDuration = (typeof PLAN_DURATIONS)[number]

export const WORKOUT_CATEGORIES = [
  'Hypertrophy',
  'Strength',
  'Fat Loss',
  'Calisthenics',
  'Athletic',
  'Full Body',
  'Home Workout',
] as const

export const DIET_CATEGORIES = [
  'High Protein',
  'Fat Loss',
  'Lean Bulk',
  'Vegetarian',
  'Balanced',
  'Low Carb',
] as const

export const UNIT_SYSTEMS = ['metric', 'imperial'] as const
export type UnitSystem = (typeof UNIT_SYSTEMS)[number]

export const DEFAULT_TIMEZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
})()

export const COMMON_TIMEZONES = Array.from(
  new Set([
    DEFAULT_TIMEZONE,
    'UTC',
    'Asia/Kolkata',
    'Asia/Dubai',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Australia/Sydney',
    'Europe/London',
    'Europe/Berlin',
    'Europe/Paris',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
    'America/Sao_Paulo',
  ])
)
