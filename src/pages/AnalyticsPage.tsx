import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { addDaysISO, formatShortDate, getWeekDatesISO, weekdayNameFromISO, weightUnit } from '../lib/date'
import { computeDaySummaries, computeStreaks, type DaySummary } from '../lib/analytics'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import { Flame, Trophy, Target, TrendingUp, Dumbbell, UtensilsCrossed, Info } from 'lucide-react'
import type { DailyLog, WorkoutCompletion, MealCompletion } from '../types/database'

export default function AnalyticsPage() {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [todayISO, setTodayISO] = useState('')
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [wComps, setWComps] = useState<WorkoutCompletion[]>([])
  const [mComps, setMComps] = useState<MealCompletion[]>([])
  const [selectedExercise, setSelectedExercise] = useState('')
  const unit = weightUnit(profile?.preferred_units)

  const loadAnalytics = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data: srvToday } = await supabase.rpc('ensure_today')
      const iso = srvToday ? String(srvToday) : new Date().toISOString().slice(0, 10)
      setTodayISO(iso)

      const [{ data: logsData }, { data: wData }, { data: mData }] = await Promise.all([
        supabase.from('daily_logs').select('*').eq('user_id', user.id).lte('log_date', iso).order('log_date'),
        supabase.from('workout_completions').select('*').eq('user_id', user.id).lte('scheduled_date', iso).order('scheduled_date'),
        supabase.from('meal_completions').select('*').eq('user_id', user.id).lte('scheduled_date', iso).order('scheduled_date'),
      ])
      setLogs((logsData as DailyLog[]) || [])
      setWComps((wData as WorkoutCompletion[]) || [])
      setMComps((mData as MealCompletion[]) || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  const computed = useMemo(() => {
    if (!todayISO) return null

    const weekDates = getWeekDatesISO(todayISO)
    const weekSummaries = computeDaySummaries(weekDates, todayISO, logs, wComps, mComps)

    const monthDates = Array.from({ length: 30 }, (_, i) => addDaysISO(todayISO, -29 + i))
    const monthSummaries = computeDaySummaries(monthDates, todayISO, logs, wComps, mComps)

    const pastWeek = weekSummaries.filter((d) => d.date <= todayISO)
    const weekWorkoutsScheduled = pastWeek.filter((d) => d.workoutTotal > 0).length
    const weekWorkoutsCompleted = pastWeek.filter((d) => d.workoutStatus === 'completed').length
    const weekWorkoutPct =
      weekWorkoutsScheduled > 0 ? Math.round((weekWorkoutsCompleted / weekWorkoutsScheduled) * 100) : 0

    const monthScheduled = monthSummaries.filter((d) => d.workoutTotal > 0).length
    const monthCompleted = monthSummaries.filter((d) => d.workoutStatus === 'completed').length
    const monthMissed = monthSummaries.filter((d) => d.workoutStatus === 'missed').length
    const monthRestDays = monthSummaries.filter((d) => d.workoutStatus === 'rest').length
    const monthWorkoutPct = monthScheduled > 0 ? Math.round((monthCompleted / monthScheduled) * 100) : 0

    // Diet metrics (30d & 7d)
    const weekMealsTotal = pastWeek.reduce((s, d) => s + d.mealsTotal, 0)
    const weekMealsDone = pastWeek.reduce((s, d) => s + d.mealsCompleted, 0)
    const weekDietPct = weekMealsTotal > 0 ? Math.round((weekMealsDone / weekMealsTotal) * 100) : 0

    const monthMealsTotal = monthSummaries.reduce((s, d) => s + d.mealsTotal, 0)
    const monthMealsDone = monthSummaries.reduce((s, d) => s + d.mealsCompleted, 0)
    const monthDietPct = monthMealsTotal > 0 ? Math.round((monthMealsDone / monthMealsTotal) * 100) : 0

    const weeklyConsistency =
      pastWeek.length > 0
        ? Math.round(
            (pastWeek.filter((d) => d.workoutCompleted > 0 || d.mealsCompleted > 0 || d.workoutStatus === 'rest')
              .length /
              pastWeek.length) *
              100
          )
        : 0

    const streaks = computeStreaks(todayISO, logs, wComps)

    // Weekly chart data
    const weekChart = weekSummaries.map((d) => ({
      day: weekdayNameFromISO(d.date).slice(0, 3),
      workoutPct: d.workoutTotal > 0 ? Math.round((d.workoutCompleted / d.workoutTotal) * 100) : 0,
      dietPct: d.mealsTotal > 0 ? Math.round((d.mealsCompleted / d.mealsTotal) * 100) : 0,
    }))

    // Nutrition chart (last 14 days where calories > 0)
    const last14 = monthSummaries.slice(-14)
    const nutritionChart = last14.map((d) => ({
      date: formatShortDate(d.date),
      calories: d.calories,
      protein: d.protein,
    }))
    const hasNutrition = nutritionChart.some((d) => d.calories > 0 || d.protein > 0)

    // Distinct logged exercises for progression chart
    const exMap = new Map<string, { date: string; weight: number | null; reps: number | null }[]>()
    wComps
      .filter((c) => c.completed)
      .forEach((c) => {
        const key = c.exercise_name
        const list = exMap.get(key) || []
        list.push({
          date: c.scheduled_date,
          weight: c.actual_weight != null ? Number(c.actual_weight) : c.target_weight != null ? Number(c.target_weight) : null,
          reps: c.actual_reps ?? c.target_reps ?? null,
        })
        exMap.set(key, list)
      })
    const exerciseNames = Array.from(exMap.keys()).sort()

    return {
      weekSummaries,
      monthSummaries,
      weekWorkoutPct,
      monthWorkoutPct,
      monthCompleted,
      monthMissed,
      monthRestDays,
      weekDietPct,
      monthDietPct,
      weeklyConsistency,
      streaks,
      weekChart,
      nutritionChart,
      hasNutrition,
      exMap,
      exerciseNames,
    }
  }, [todayISO, logs, wComps, mComps])

  useEffect(() => {
    if (computed && computed.exerciseNames.length > 0 && !selectedExercise) {
      setSelectedExercise(computed.exerciseNames[0])
    }
  }, [computed, selectedExercise])

  if (loading || !computed) {
    return (
      <div className="p-4 md:p-6 max-w-6xl space-y-6">
        <div className="skeleton h-9 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-64 rounded-xl" />
      </div>
    )
  }

  const progressionData = (selectedExercise ? computed.exMap.get(selectedExercise) || [] : []).map((p) => ({
    date: formatShortDate(p.date),
    weight: p.weight ?? 0,
    reps: p.reps ?? 0,
  }))

  const statusColor: Record<DaySummary['workoutStatus'], string> = {
    completed: 'bg-accent text-black',
    partial: 'bg-accent/40 text-white',
    missed: 'bg-danger/30 text-danger',
    rest: 'bg-bg-hover text-text-muted',
    unscheduled: 'bg-bg-primary text-text-muted border border-border',
    future: 'bg-bg-primary text-text-muted opacity-40',
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Progress & Analytics</h1>
        <p className="text-text-secondary text-sm mt-1">
          Computed strictly from your historical records. Future dates and rest days are never counted as missed.
        </p>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
            <Flame className="w-4 h-4 text-accent" /> Current Streak
          </div>
          <p className="text-2xl font-bold">
            {computed.streaks.currentStreak} <span className="text-sm font-normal text-text-muted">days</span>
          </p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
            <Trophy className="w-4 h-4 text-orange-400" /> Longest Streak
          </div>
          <p className="text-2xl font-bold">
            {computed.streaks.longestStreak} <span className="text-sm font-normal text-text-muted">days</span>
          </p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
            <Target className="w-4 h-4 text-blue-400" /> Weekly Consistency
          </div>
          <p className="text-2xl font-bold">{computed.weeklyConsistency}%</p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
            <TrendingUp className="w-4 h-4 text-purple-400" /> 30-Day Adherence
          </div>
          <p className="text-2xl font-bold">{computed.monthWorkoutPct}%</p>
          <p className="text-xs text-text-muted mt-0.5">Diet: {computed.monthDietPct}%</p>
        </div>
      </div>

      {/* Workout & Diet Detailed Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-accent" /> Workout Analytics (30 Days)
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-bg-primary border border-border rounded-lg p-3">
              <p className="text-xs text-text-muted">Weekly Completion</p>
              <p className="text-lg font-bold mt-0.5">{computed.weekWorkoutPct}%</p>
            </div>
            <div className="bg-bg-primary border border-border rounded-lg p-3">
              <p className="text-xs text-text-muted">Monthly Completion</p>
              <p className="text-lg font-bold mt-0.5">{computed.monthWorkoutPct}%</p>
            </div>
            <div className="bg-bg-primary border border-border rounded-lg p-3">
              <p className="text-xs text-text-muted">Workouts Completed</p>
              <p className="text-lg font-bold text-accent mt-0.5">{computed.monthCompleted}</p>
            </div>
            <div className="bg-bg-primary border border-border rounded-lg p-3">
              <p className="text-xs text-text-muted">Missed / Rest Days</p>
              <p className="text-lg font-bold mt-0.5">
                <span className="text-danger">{computed.monthMissed}</span>
                <span className="text-text-muted font-normal"> / </span>
                <span>{computed.monthRestDays}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="bg-bg-card border border-border rounded-xl p-5">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-blue-400" /> Diet Analytics
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-bg-primary border border-border rounded-lg p-3">
              <p className="text-xs text-text-muted">Weekly Adherence</p>
              <p className="text-lg font-bold mt-0.5">{computed.weekDietPct}%</p>
            </div>
            <div className="bg-bg-primary border border-border rounded-lg p-3">
              <p className="text-xs text-text-muted">30-Day Adherence</p>
              <p className="text-lg font-bold mt-0.5">{computed.monthDietPct}%</p>
            </div>
            <div className="bg-bg-primary border border-border rounded-lg p-3">
              <p className="text-xs text-text-muted">Total Meals Logged</p>
              <p className="text-lg font-bold text-blue-400 mt-0.5">
                {mComps.filter((m) => m.completed).length}
              </p>
            </div>
            <div className="bg-bg-primary border border-border rounded-lg p-3">
              <p className="text-xs text-text-muted">Avg Calories (logged days)</p>
              <p className="text-lg font-bold mt-0.5">
                {(() => {
                  const daysWithCal = computed.monthSummaries.filter((d) => d.calories > 0)
                  if (daysWithCal.length === 0) return '—'
                  return `${Math.round(daysWithCal.reduce((s, d) => s + d.calories, 0) / daysWithCal.length)} kcal`
                })()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Completion % Chart */}
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <h3 className="text-base font-semibold mb-4">This Week's Completion (%)</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={computed.weekChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#888', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#888', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', fontSize: '12px' }}
              />
              <Bar dataKey="workoutPct" name="Workout %" fill="#84cc16" radius={[4, 4, 0, 0]} />
              <Bar dataKey="dietPct" name="Diet %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Exercise Progression Chart */}
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="text-base font-semibold">Exercise Progression</h3>
            {computed.exerciseNames.length > 0 && (
              <select
                value={selectedExercise}
                onChange={(e) => setSelectedExercise(e.target.value)}
                className="bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-accent"
              >
                {computed.exerciseNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            )}
          </div>
          {progressionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={progressionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="weight" name={`Weight (${unit})`} stroke="#84cc16" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="reps" name="Reps" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-56 flex items-center justify-center text-text-muted text-sm text-center px-4">
              Complete exercises with weights or reps logged to chart your strength progression.
            </div>
          )}
        </div>
      </div>

      {/* Optional Calorie & Protein Chart */}
      {computed.hasNutrition && (
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <h3 className="text-base font-semibold mb-4">14-Day Calories & Protein Logged</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={computed.nutritionChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', fontSize: '12px' }}
              />
              <Bar dataKey="calories" name="Calories (kcal)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="protein" name="Protein (g)" fill="#84cc16" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 30-Day Monthly Overview Grid */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-base font-semibold">30-Day Workout Overview</h3>
          <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-accent inline-block" /> Complete</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-accent/40 inline-block" /> Partial</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-danger/30 inline-block" /> Missed</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-bg-hover inline-block" /> Rest</span>
          </div>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
          {computed.monthSummaries.map((d) => (
            <div
              key={d.date}
              title={`${d.date}: ${d.workoutStatus} (${d.workoutCompleted}/${d.workoutTotal} exercises)`}
              className={`rounded-lg p-2 text-center text-xs font-medium ${statusColor[d.workoutStatus]}`}
            >
              {d.date.slice(8)}
            </div>
          ))}
        </div>
      </div>

      {/* Documented Streak Logic */}
      <div className="bg-bg-secondary border border-border rounded-xl p-4 flex items-start gap-3 text-xs text-text-secondary">
        <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
        <p>
          <strong>How streaks work:</strong> Each scheduled training day with at least one completed exercise extends
          your streak by 1 day. Designated rest days (and unscheduled weekend days in 5/6-day plans) preserve your
          streak without breaking it. Future dates are never counted as missed.
        </p>
      </div>
    </div>
  )
}
