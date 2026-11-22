import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { addDaysISO, formatPrettyDate, formatTime12h, weekdayNameFromISO } from '../lib/date'
import toast from 'react-hot-toast'
import {
  CheckCircle2, Circle, UtensilsCrossed, ArrowLeft, Loader2, Trophy,
  ChevronLeft, ChevronRight, Calendar, Droplets, Plus, Minus, Clock, MessageSquare
} from 'lucide-react'
import type { DailyLog, MealCompletion } from '../types/database'

export default function DietChecklist() {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [todayISO, setTodayISO] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null)
  const [meals, setMeals] = useState<MealCompletion[]>([])
  const [waterMl, setWaterMl] = useState(0)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [waterBusy, setWaterBusy] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  const waterGoal = profile?.water_goal_ml || 2500

  const loadDate = useCallback(
    async (dateISO: string) => {
      if (!user) return
      setLoading(true)
      try {
        const [{ data: log }, { data: rows }, { data: water }] = await Promise.all([
          supabase.from('daily_logs').select('*').eq('user_id', user.id).eq('log_date', dateISO).maybeSingle(),
          supabase
            .from('meal_completions')
            .select('*')
            .eq('user_id', user.id)
            .eq('scheduled_date', dateISO)
            .order('sort_order'),
          supabase.from('water_logs').select('amount_ml').eq('user_id', user.id).eq('logged_date', dateISO).maybeSingle(),
        ])
        setDailyLog((log as DailyLog | null) ?? null)
        setMeals((rows as MealCompletion[]) || [])
        setWaterMl(water?.amount_ml ?? 0)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    },
    [user]
  )

  useEffect(() => {
    if (!user) return
    let active = true
    async function init() {
      const { data: srvToday, error } = await supabase.rpc('ensure_today')
      if (!active) return
      if (error || !srvToday) {
        toast.error(error?.message || 'Could not initialise today')
        setLoading(false)
        return
      }
      const iso = String(srvToday)
      setTodayISO(iso)
      setSelectedDate(iso)
      await loadDate(iso)
    }
    init()
    return () => {
      active = false
    }
  }, [user, loadDate])

  function changeDate(delta: number) {
    if (!selectedDate) return
    const next = addDaysISO(selectedDate, delta)
    if (todayISO && next > todayISO) return
    setSelectedDate(next)
    setEditingNoteId(null)
    loadDate(next)
  }

  async function toggleMeal(meal: MealCompletion) {
    setSavingId(meal.id)
    try {
      const { data, error } = await supabase.rpc('update_meal_completion', {
        p_id: meal.id,
        p_patch: { completed: !meal.completed },
      })
      if (error) throw error
      setMeals((prev) => prev.map((m) => (m.id === meal.id ? (data as MealCompletion) : m)))
    } catch (err: any) {
      toast.error(err.message || 'Failed to update meal')
    } finally {
      setSavingId(null)
    }
  }

  async function saveMealNote(meal: MealCompletion) {
    setSavingId(meal.id)
    try {
      const { data, error } = await supabase.rpc('update_meal_completion', {
        p_id: meal.id,
        p_patch: { notes: noteText },
      })
      if (error) throw error
      setMeals((prev) => prev.map((m) => (m.id === meal.id ? (data as MealCompletion) : m)))
      setEditingNoteId(null)
      toast.success('Note saved')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save note')
    } finally {
      setSavingId(null)
    }
  }

  async function adjustWater(delta: number) {
    if (selectedDate !== todayISO) return
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

  const completedCount = meals.filter((m) => m.completed).length
  const totalCount = meals.length
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const allDone = totalCount > 0 && completedCount === totalCount
  const isToday = selectedDate === todayISO

  // Optional macro totals for completed meals
  const consumedCal = Math.round(
    meals.filter((m) => m.completed).reduce((s, m) => s + (Number(m.total_calories) || 0), 0)
  )
  const targetCal = Math.round(meals.reduce((s, m) => s + (Number(m.total_calories) || 0), 0))
  const consumedPro = Math.round(
    meals.filter((m) => m.completed).reduce((s, m) => s + (Number(m.total_protein) || 0), 0)
  )
  const targetPro = Math.round(meals.reduce((s, m) => s + (Number(m.total_protein) || 0), 0))
  const waterPct = waterGoal > 0 ? Math.min(100, Math.round((waterMl / waterGoal) * 100)) : 0

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-3xl space-y-4">
        <div className="skeleton h-8 w-52" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-28 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/dashboard" className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>

        {selectedDate && (
          <div className="flex items-center gap-1 bg-bg-card border border-border rounded-lg p-1">
            <button onClick={() => changeDate(-1)} className="p-1.5 text-text-secondary hover:text-text-primary rounded">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium px-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-accent" />
              {isToday ? 'Today' : selectedDate}
            </span>
            <button
              onClick={() => changeDate(1)}
              disabled={isToday}
              className="p-1.5 text-text-secondary hover:text-text-primary rounded disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {selectedDate ? `${weekdayNameFromISO(selectedDate)}'s Meals` : "Today's Meals"}
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            {dailyLog?.diet_title || 'No diet scheduled'}
            {selectedDate ? ` • ${formatPrettyDate(selectedDate)}` : ''}
          </p>
        </div>
        {totalCount > 0 && (
          <div className="text-right">
            <p className="text-2xl font-bold text-accent">{pct}%</p>
            <p className="text-xs text-text-muted">
              {completedCount}/{totalCount} meals
            </p>
          </div>
        )}
      </div>

      {totalCount > 0 && (
        <div className="h-2 bg-bg-hover rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      )}

      {/* Optional Nutrition Summary + Water Tracker */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {targetCal > 0 && (
          <div className="bg-bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider">Nutrition Logged</p>
              <p className="text-lg font-bold mt-1">
                {consumedCal} <span className="text-xs text-text-muted font-normal">/ {targetCal} kcal</span>
              </p>
              {targetPro > 0 && (
                <p className="text-xs text-text-secondary mt-0.5">
                  Protein: {consumedPro}g / {targetPro}g
                </p>
              )}
            </div>
          </div>
        )}

        <div className={`bg-bg-card border border-border rounded-xl p-4 ${targetCal === 0 ? 'sm:col-span-2' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium">Water Intake</span>
            </div>
            <span className="text-xs text-text-secondary">
              {waterMl} / {waterGoal} ml ({waterPct}%)
            </span>
          </div>
          <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden mb-3">
            <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${waterPct}%` }} />
          </div>
          {isToday && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => adjustWater(-250)}
                disabled={waterBusy || waterMl === 0}
                className="px-2.5 py-1 rounded-lg bg-bg-hover text-xs text-text-secondary hover:text-text-primary disabled:opacity-40 flex items-center gap-1"
              >
                <Minus className="w-3 h-3" /> 250ml
              </button>
              <button
                onClick={() => adjustWater(250)}
                disabled={waterBusy}
                className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 text-xs font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> 250ml
              </button>
              <button
                onClick={() => adjustWater(500)}
                disabled={waterBusy}
                className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 text-xs font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> 500ml
              </button>
            </div>
          )}
        </div>
      </div>

      {allDone && (
        <div className="bg-accent-muted border border-accent/30 rounded-xl p-5 text-center">
          <Trophy className="w-8 h-8 text-accent mx-auto mb-2" />
          <h3 className="text-base font-semibold text-accent">All Meals Completed!</h3>
          <p className="text-text-secondary text-xs mt-1">100% diet adherence recorded for {selectedDate}.</p>
        </div>
      )}

      {/* Meals List */}
      {!dailyLog?.diet_plan_id && meals.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-2xl p-10 text-center">
          <UtensilsCrossed className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-1">
            {isToday ? 'No active diet plan' : 'No meals recorded for this day'}
          </h3>
          <p className="text-text-muted text-sm mb-5">
            {isToday
              ? 'Activate a diet plan or copy one from the Plan Library to track daily meals.'
              : 'No diet plan was active on this date.'}
          </p>
          {isToday && (
            <div className="flex justify-center gap-3">
              <Link to="/diet" className="bg-accent hover:bg-accent-hover text-black font-semibold px-5 py-2 rounded-lg text-sm">
                My Diet Plans
              </Link>
              <Link to="/plans" className="border border-border hover:border-border-light px-5 py-2 rounded-lg text-sm">
                Browse Library
              </Link>
            </div>
          )}
        </div>
      ) : meals.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-2xl p-8 text-center">
          <p className="text-text-muted text-sm">No meals scheduled for this weekday.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meals.map((meal) => {
            const isEditingNote = editingNoteId === meal.id
            return (
              <div
                key={meal.id}
                className={`bg-bg-card border rounded-xl p-4 transition-colors ${
                  meal.completed ? 'border-accent/30 bg-accent/5' : 'border-border'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleMeal(meal)}
                    disabled={savingId === meal.id}
                    className="flex-shrink-0 mt-0.5"
                    aria-label={meal.completed ? 'Mark incomplete' : 'Mark completed'}
                  >
                    {savingId === meal.id ? (
                      <Loader2 className="w-6 h-6 text-accent animate-spin" />
                    ) : meal.completed ? (
                      <CheckCircle2 className="w-6 h-6 text-accent" />
                    ) : (
                      <Circle className="w-6 h-6 text-text-muted hover:text-accent transition-colors" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold ${meal.completed ? 'line-through text-text-muted' : ''}`}>
                          {meal.meal_name}
                        </h3>
                        {meal.scheduled_time && (
                          <span className="text-xs text-text-muted flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatTime12h(meal.scheduled_time)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {meal.total_calories != null && Number(meal.total_calories) > 0 && (
                          <span className="text-xs text-text-muted">
                            {Math.round(Number(meal.total_calories))} kcal
                            {meal.total_protein != null ? ` • ${Math.round(Number(meal.total_protein))}g P` : ''}
                          </span>
                        )}
                        <button
                          onClick={() => {
                            if (isEditingNote) {
                              setEditingNoteId(null)
                            } else {
                              setEditingNoteId(meal.id)
                              setNoteText(meal.notes || '')
                            }
                          }}
                          className="text-text-muted hover:text-text-primary p-1"
                          title="Add note"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {Array.isArray(meal.items) && meal.items.length > 0 && (
                      <ul className="mt-2.5 space-y-1">
                        {meal.items.map((it, idx) => (
                          <li key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-text-secondary">
                              • {it.food_name}
                              {it.quantity ? ` (${it.quantity})` : ''}
                            </span>
                            {it.calories != null && (
                              <span className="text-xs text-text-muted">{it.calories} kcal</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {meal.notes && !isEditingNote && (
                      <p className="text-xs text-text-muted mt-2 italic">Note: {meal.notes}</p>
                    )}

                    {isEditingNote && (
                      <div className="mt-3 flex gap-2">
                        <input
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          className="flex-1 bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-accent"
                          placeholder="Add a note about this meal..."
                        />
                        <button
                          onClick={() => saveMealNote(meal)}
                          disabled={savingId === meal.id}
                          className="bg-accent hover:bg-accent-hover text-black font-semibold text-xs px-3 py-1.5 rounded-lg"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
