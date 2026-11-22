import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  formatPrettyDate,
  getCurrentHourInTz,
  getWeekDatesISO,
  addDaysISO,
  weightUnit,
} from '../lib/date'
import { computeDaySummaries, computeStreaks } from '../lib/analytics'
import toast from 'react-hot-toast'
import {
  Dumbbell, UtensilsCrossed, BarChart3, BookOpen, Calendar, CheckCircle2,
  ArrowRight, Flame, Target, Zap, Clock, Edit3, Droplets, Plus, Bell, Trophy
} from 'lucide-react'
import type {
  DailyLog, WorkoutCompletion, MealCompletion, PersonalRecord, UserActivePlan
} from '../types/database'

function ProgressRing({ percentage, size = 56, strokeWidth = 5 }: { percentage: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="#2a2a2a" strokeWidth={strokeWidth} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#84cc16"
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  )
}

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [todayISO, setTodayISO] = useState('')
  const [activePlans, setActivePlans] = useState<UserActivePlan | null>(null)
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null)
  const [todayWorkouts, setTodayWorkouts] = useState<WorkoutCompletion[]>([])
  const [todayMeals, setTodayMeals] = useState<MealCompletion[]>([])
  const [waterMl, setWaterMl] = useState(0)
  const [waterBusy, setWaterBusy] = useState(false)

  // Weekly & streak metrics
  const [weeklyWorkoutsDone, setWeeklyWorkoutsDone] = useState(0)
  const [weeklyDietPct, setWeeklyDietPct] = useState(0)
  const [weeklyConsistencyPct, setWeeklyConsistencyPct] = useState(0)
  const [weeklyRestDays, setWeeklyRestDays] = useState(0)
  const [streak, setStreak] = useState(0)
  const [missedYesterday, setMissedYesterday] = useState(false)

  // Recent activity & PRs
  const [recentActivity, setRecentActivity] = useState<
    { label: string; detail: string; time: string; type: 'workout' | 'diet' }[]
  >([])
  const [prs, setPrs] = useState<PersonalRecord[]>([])

  const tz = profile?.timezone || 'UTC'
  const unit = weightUnit(profile?.preferred_units)
  const waterGoal = profile?.water_goal_ml || 2500

  const greeting = (() => {
    const h = getCurrentHourInTz(tz)
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  const loadDashboard = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data: srvToday, error: ensureErr } = await supabase.rpc('ensure_today')
      if (ensureErr) throw ensureErr
      const iso = String(srvToday)
      setTodayISO(iso)

      const weekDates = getWeekDatesISO(iso)
      const since90 = addDaysISO(iso, -90)

      const [
        { data: activeData },
        { data: logsData },
        { data: wData },
        { data: mData },
        { data: waterData },
        { data: prData },
      ] = await Promise.all([
        supabase.from('user_active_plans').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('daily_logs').select('*').eq('user_id', user.id).gte('log_date', since90).lte('log_date', iso),
        supabase
          .from('workout_completions')
          .select('*')
          .eq('user_id', user.id)
          .gte('scheduled_date', since90)
          .lte('scheduled_date', iso)
          .order('sort_order'),
        supabase
          .from('meal_completions')
          .select('*')
          .eq('user_id', user.id)
          .gte('scheduled_date', since90)
          .lte('scheduled_date', iso)
          .order('sort_order'),
        supabase.from('water_logs').select('amount_ml').eq('user_id', user.id).eq('logged_date', iso).maybeSingle(),
        supabase.rpc('recent_personal_records', { p_limit: 3 }),
      ])

      const logs = (logsData as DailyLog[]) || []
      const wComps = (wData as WorkoutCompletion[]) || []
      const mComps = (mData as MealCompletion[]) || []

      setActivePlans((activeData as UserActivePlan | null) ?? null)
      setTodayLog(logs.find((l) => l.log_date === iso) || null)
      setTodayWorkouts(wComps.filter((c) => c.scheduled_date === iso))
      setTodayMeals(mComps.filter((c) => c.scheduled_date === iso))
      setWaterMl(waterData?.amount_ml ?? 0)
      setPrs((prData as PersonalRecord[]) || [])

      // Weekly summaries (Mon..Sun of current week, ignoring future dates)
      const summaries = computeDaySummaries(weekDates, iso, logs, wComps, mComps)
      const pastOrToday = summaries.filter((s) => s.date <= iso)
      const wDoneDays = pastOrToday.filter((s) => s.workoutStatus === 'completed').length
      const restDays = pastOrToday.filter((s) => s.workoutStatus === 'rest').length
      const weekMealsTotal = pastOrToday.reduce((acc, s) => acc + s.mealsTotal, 0)
      const weekMealsDone = pastOrToday.reduce((acc, s) => acc + s.mealsCompleted, 0)
      const activeDaysCount = pastOrToday.filter(
        (s) => s.workoutCompleted > 0 || s.mealsCompleted > 0 || s.workoutStatus === 'rest'
      ).length

      setWeeklyWorkoutsDone(wDoneDays)
      setWeeklyRestDays(restDays)
      setWeeklyDietPct(weekMealsTotal > 0 ? Math.round((weekMealsDone / weekMealsTotal) * 100) : 0)
      setWeeklyConsistencyPct(pastOrToday.length > 0 ? Math.round((activeDaysCount / pastOrToday.length) * 100) : 0)

      // Missed yesterday?
      const yest = addDaysISO(iso, -1)
      const yestSummary = computeDaySummaries([yest], iso, logs, wComps, mComps)[0]
      setMissedYesterday(yestSummary?.workoutStatus === 'missed')

      // Streaks
      const { currentStreak } = computeStreaks(iso, logs, wComps)
      setStreak(currentStreak)

      // Recent activity
      const recent: { label: string; detail: string; time: string; ts: number; type: 'workout' | 'diet' }[] = []
      wComps
        .filter((w) => w.completed && w.completed_at)
        .forEach((w) => {
          recent.push({
            label: w.exercise_name,
            detail:
              w.actual_weight != null
                ? `${w.actual_sets ?? w.target_sets ?? '-'}×${w.actual_reps ?? w.target_reps ?? '-'} @ ${w.actual_weight}${unit}`
                : `${w.target_sets ?? '-'}×${w.target_reps ?? '-'}`,
            time: new Date(w.completed_at!).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            }),
            ts: new Date(w.completed_at!).getTime(),
            type: 'workout',
          })
        })
      mComps
        .filter((m) => m.completed && m.completed_at)
        .forEach((m) => {
          recent.push({
            label: m.meal_name,
            detail: m.total_calories ? `${Math.round(Number(m.total_calories))} kcal` : 'Completed meal',
            time: new Date(m.completed_at!).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            }),
            ts: new Date(m.completed_at!).getTime(),
            type: 'diet',
          })
        })
      recent.sort((a, b) => b.ts - a.ts)
      setRecentActivity(recent.slice(0, 6))
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }, [user, unit])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  async function quickWater(delta: number) {
    setWaterBusy(true)
    try {
      const { data, error } = await supabase.rpc('log_water', { p_delta_ml: delta })
      if (error) throw error
      setWaterMl(Number(data) || 0)
    } catch (err: any) {
      toast.error(err.message || 'Could not log water')
    } finally {
      setWaterBusy(false)
    }
  }

  const wTotal = todayWorkouts.length
  const wDone = todayWorkouts.filter((c) => c.completed).length
  const wPct = todayLog?.workout_is_rest ? 100 : wTotal > 0 ? Math.round((wDone / wTotal) * 100) : 0

  const mTotal = todayMeals.length
  const mDone = todayMeals.filter((c) => c.completed).length
  const mPct = mTotal > 0 ? Math.round((mDone / mTotal) * 100) : 0

  const overallDenom = wTotal + mTotal
  const overallPct = overallDenom > 0 ? Math.round(((wDone + mDone) / overallDenom) * 100) : 0

  // Optional in-app reminders based on user preferences
  const reminders: { title: string; action: string; to?: string }[] = []
  if (profile?.notify_workout && wTotal > 0 && wDone < wTotal) {
    reminders.push({
      title: `Today's workout: ${wTotal - wDone} exercise${wTotal - wDone > 1 ? 's' : ''} left`,
      action: 'Open checklist',
      to: '/workouts/today',
    })
  }
  if (profile?.notify_meals && mTotal > 0 && mDone < mTotal) {
    reminders.push({
      title: `Planned meals: ${mTotal - mDone} meal${mTotal - mDone > 1 ? 's' : ''} remaining today`,
      action: 'View meals',
      to: '/diet/today',
    })
  }
  if (profile?.notify_water && waterMl < waterGoal) {
    reminders.push({
      title: `Water goal: ${waterGoal - waterMl} ml left to reach ${waterGoal} ml`,
      action: 'Track water',
      to: '/diet/today',
    })
  }
  if (profile?.notify_missed && missedYesterday) {
    reminders.push({
      title: 'You missed yesterday’s workout — bounce back today!',
      action: 'Start today',
      to: '/workouts/today',
    })
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-6xl space-y-6">
        <div className="skeleton h-10 w-72" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-36 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-52 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            {greeting}, {profile?.display_name || profile?.username || 'there'}
          </h1>
          <p className="text-text-secondary text-sm mt-1 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent" />
            {todayISO ? formatPrettyDate(todayISO) : ''} <span className="text-text-muted">({tz})</span>
          </p>
        </div>
      </div>

      {/* Today's Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Today's Workout */}
        <Link
          to="/workouts/today"
          className="bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-colors group"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0 pr-2">
              <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Today's Workout</p>
              <h3 className="text-lg font-semibold mt-1 truncate">
                {!activePlans?.workout_plan_id
                  ? 'No active plan'
                  : todayLog?.workout_is_rest
                    ? 'Rest Day'
                    : todayLog?.workout_title || 'Scheduled'}
              </h3>
            </div>
            <div className="relative flex-shrink-0">
              <ProgressRing percentage={wPct} size={48} strokeWidth={4} />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{wPct}%</span>
            </div>
          </div>
          <p className="text-text-secondary text-sm">
            {!activePlans?.workout_plan_id
              ? 'Activate a plan to start'
              : todayLog?.workout_is_rest
                ? 'Recovery day'
                : `${wDone}/${wTotal} exercises completed`}
          </p>
          <div className="flex items-center gap-1 text-accent text-xs font-medium mt-3">
            {todayLog?.workout_is_rest ? 'View schedule' : 'Open workout checklist'}{' '}
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Today's Diet */}
        <Link
          to="/diet/today"
          className="bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-colors group"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0 pr-2">
              <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Today's Diet</p>
              <h3 className="text-lg font-semibold mt-1 truncate">
                {!activePlans?.diet_plan_id ? 'No active plan' : todayLog?.diet_title || 'Meal Plan'}
              </h3>
            </div>
            <div className="relative flex-shrink-0">
              <ProgressRing percentage={mPct} size={48} strokeWidth={4} />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{mPct}%</span>
            </div>
          </div>
          <p className="text-text-secondary text-sm">
            {!activePlans?.diet_plan_id ? 'Activate a diet plan' : `${mDone}/${mTotal} meals completed`}
          </p>
          <div className="flex items-center gap-1 text-accent text-xs font-medium mt-3">
            Open meal checklist <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Overall Daily Progress + Quick Water */}
        <div className="bg-bg-card border border-border rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Daily Progress</p>
              <p className="text-3xl font-bold mt-1">
                {overallPct}
                <span className="text-base text-text-muted font-normal">%</span>
              </p>
            </div>
            <div className="relative">
              <ProgressRing percentage={overallPct} size={56} strokeWidth={5} />
              <span className="absolute inset-0 flex items-center justify-center">
                <Zap className="w-4 h-4 text-accent" />
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
            <span className="text-xs text-text-secondary flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-blue-400" />
              {waterMl} / {waterGoal} ml
            </span>
            <button
              onClick={() => quickWater(250)}
              disabled={waterBusy}
              className="text-xs bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 px-2.5 py-1 rounded-md font-medium flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> 250ml
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { to: '/workouts/today', icon: Dumbbell, label: 'Start Workout', color: 'text-accent' },
          { to: '/diet/today', icon: UtensilsCrossed, label: 'View Diet', color: 'text-blue-400' },
          { to: '/workouts', icon: Edit3, label: 'Edit Schedule', color: 'text-purple-400' },
          { to: '/analytics', icon: BarChart3, label: 'View Progress', color: 'text-pink-400' },
          { to: '/plans', icon: BookOpen, label: 'Browse Plans', color: 'text-orange-400' },
        ].map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="bg-bg-card border border-border rounded-xl p-4 hover:border-border-light transition-colors text-center"
          >
            <action.icon className={`w-5 h-5 mx-auto mb-2 ${action.color}`} />
            <p className="text-xs font-medium text-text-secondary">{action.label}</p>
          </Link>
        ))}
      </div>

      {/* Optional In-App Reminders */}
      {reminders.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-accent" /> Reminders
          </p>
          <div className="divide-y divide-border">
            {reminders.map((r, i) => (
              <div key={i} className="py-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-text-secondary">{r.title}</span>
                {r.to && (
                  <Link to={r.to} className="text-xs text-accent hover:text-accent-hover font-medium whitespace-nowrap">
                    {r.action} →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Summary + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Weekly Summary</h3>
            <Link to="/analytics" className="text-xs text-accent hover:text-accent-hover">
              Full analytics →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-bg-primary border border-border rounded-lg p-3">
              <p className="text-xs text-text-muted">Workouts Done</p>
              <p className="text-xl font-bold mt-1">{weeklyWorkoutsDone}</p>
            </div>
            <div className="bg-bg-primary border border-border rounded-lg p-3">
              <p className="text-xs text-text-muted">Diet Adherence</p>
              <p className="text-xl font-bold mt-1">{weeklyDietPct}%</p>
            </div>
            <div className="bg-bg-primary border border-border rounded-lg p-3">
              <p className="text-xs text-text-muted flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-400" /> Streak
              </p>
              <p className="text-xl font-bold mt-1">{streak}d</p>
            </div>
            <div className="bg-bg-primary border border-border rounded-lg p-3">
              <p className="text-xs text-text-muted flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-accent" /> Consistency
              </p>
              <p className="text-xl font-bold mt-1">{weeklyConsistencyPct}%</p>
            </div>
            <div className="bg-bg-primary border border-border rounded-lg p-3">
              <p className="text-xs text-text-muted">Rest Days</p>
              <p className="text-xl font-bold mt-1">{weeklyRestDays}</p>
            </div>
          </div>

          {/* Personal Records */}
          {prs.length > 0 && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-accent" /> Recent Personal Records
              </p>
              <div className="space-y-2">
                {prs.map((pr, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-bg-primary rounded-lg px-3 py-2">
                    <span className="font-medium">{pr.exercise_name}</span>
                    <span className="text-accent font-semibold">
                      {pr.actual_weight}
                      {unit} <span className="text-text-muted font-normal">(prev {pr.previous_best}{unit})</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <h3 className="text-base font-semibold mb-4">Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-8 h-8 text-text-muted mx-auto mb-2" />
              <p className="text-text-muted text-sm">No completed activity yet</p>
              <p className="text-text-muted text-xs mt-1">
                Check off exercises or meals to build your training log.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      item.type === 'workout' ? 'bg-accent-muted text-accent' : 'bg-blue-500/10 text-blue-400'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className="text-xs text-text-muted truncate">
                      {item.detail} • {item.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Empty CTA if no plans active */}
      {!activePlans?.workout_plan_id && !activePlans?.diet_plan_id && (
        <div className="bg-bg-card border border-accent/30 rounded-xl p-6 text-center">
          <Zap className="w-9 h-9 text-accent mx-auto mb-2" />
          <h3 className="text-lg font-semibold mb-1">Activate your first weekly schedule</h3>
          <p className="text-text-secondary text-sm mb-4">
            Create a custom workout or diet schedule, or apply a ready-made plan from the library.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/workouts" className="bg-accent hover:bg-accent-hover text-black font-semibold px-5 py-2 rounded-lg text-sm">
              Create Workout Plan
            </Link>
            <Link to="/plans" className="border border-border hover:border-border-light px-5 py-2 rounded-lg text-sm font-medium">
              Browse Premade Plans
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
