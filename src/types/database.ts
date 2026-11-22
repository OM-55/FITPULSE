export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Profile {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  role: 'user' | 'admin'
  timezone: string
  preferred_units: 'metric' | 'imperial'
  profile_visibility: 'public' | 'private'
  show_stats: boolean
  onboarding_completed: boolean
  notify_workout: boolean
  notify_meals: boolean
  notify_water: boolean
  notify_missed: boolean
  browser_notifications: boolean
  water_goal_ml: number
  created_at: string
  updated_at: string
}

export interface WorkoutPlan {
  id: string
  owner_id: string | null
  name: string
  description: string | null
  duration_days: number
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | null
  category: string | null
  equipment: string | null
  visibility: 'private' | 'public'
  is_premade: boolean
  source_plan_id: string | null
  created_at: string
  updated_at: string
}

export interface WorkoutDay {
  id: string
  plan_id: string
  weekday: number
  title: string
  is_rest_day: boolean
  sort_order: number
}

export interface WorkoutExercise {
  id: string
  workout_day_id: string
  exercise_name: string
  sets: number
  reps: number
  target_weight: number | null
  rest_seconds: number | null
  instructions: string | null
  notes: string | null
  sort_order: number
}

export interface DietPlan {
  id: string
  owner_id: string | null
  name: string
  description: string | null
  duration_days: number
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | null
  category: string | null
  visibility: 'private' | 'public'
  is_premade: boolean
  source_plan_id: string | null
  created_at: string
  updated_at: string
}

export interface DietDay {
  id: string
  plan_id: string
  weekday: number
  title: string
  sort_order: number
}

export interface DietMeal {
  id: string
  diet_day_id: string
  meal_name: string
  scheduled_time: string | null
  notes: string | null
  sort_order: number
}

export interface MealItem {
  id?: string
  meal_id?: string
  food_name: string
  quantity: string | null
  calories: number | null
  protein: number | null
  carbohydrates: number | null
  fats: number | null
  sort_order?: number
}

export interface UserActivePlan {
  user_id: string
  workout_plan_id: string | null
  diet_plan_id: string | null
  workout_since: string | null
  diet_since: string | null
  created_at: string
  updated_at: string
}

export interface DailyLog {
  id: string
  user_id: string
  log_date: string
  weekday: number
  workout_plan_id: string | null
  workout_title: string | null
  workout_is_rest: boolean | null
  diet_plan_id: string | null
  diet_title: string | null
  created_at: string
  updated_at: string
}

export interface WorkoutCompletion {
  id: string
  user_id: string
  plan_id: string | null
  exercise_id: string | null
  scheduled_date: string
  day_title: string | null
  exercise_name: string
  target_sets: number | null
  target_reps: number | null
  target_weight: number | null
  sort_order: number
  completed: boolean
  completed_at: string | null
  actual_sets: number | null
  actual_reps: number | null
  actual_weight: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface MealCompletion {
  id: string
  user_id: string
  plan_id: string | null
  meal_id: string | null
  scheduled_date: string
  meal_name: string
  scheduled_time: string | null
  items: MealItem[]
  total_calories: number | null
  total_protein: number | null
  total_carbs: number | null
  total_fats: number | null
  sort_order: number
  completed: boolean
  completed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface WaterLog {
  id: string
  user_id: string
  logged_date: string
  amount_ml: number
  created_at: string
  updated_at: string
}

export interface PersonalRecord {
  exercise_name: string
  actual_weight: number
  previous_best: number
  scheduled_date: string
}

export interface PublicProfileData {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  created_at: string
  stats: {
    workout_days_completed: number
    meals_completed: number
    member_since: string
  } | null
  workout_plans: Pick<WorkoutPlan, 'id' | 'name' | 'description' | 'duration_days' | 'difficulty' | 'category'>[]
  diet_plans: Pick<DietPlan, 'id' | 'name' | 'description' | 'duration_days' | 'difficulty' | 'category'>[]
}

export interface SearchProfileResult {
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
}

// Keep a stub Database export for backwards compatibility
export interface Database {
  public: {
    Tables: Record<string, unknown>
  }
}
