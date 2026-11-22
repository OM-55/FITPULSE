import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { addDaysISO, formatPrettyDate, weekdayNameFromISO, weightUnit } from '../lib/date'
import toast from 'react-hot-toast'
import {
  CheckCircle2, Circle, Dumbbell, ArrowLeft, Loader2, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, Trophy, CheckCheck, Calendar
} from 'lucide-react'
import type { DailyLog, WorkoutCompletion } from '../types/database'

export default function WorkoutChecklist() {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [todayISO, setTodayISO] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null)
  const [items, setItems] = useState<WorkoutCompletion[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<
    Record<string, { actual_sets: string; actual_reps: string; actual_weight: string; notes: string }>
  >({})
  const unit = weightUnit(profile?.preferred_units)

  const loadDate = useCallback(
    async (dateISO: string) => {
      if (!user) return
      setLoading(true)
      try {
        const [{ data: log }, { data: rows }] = await Promise.all([
          supabase
            .from('daily_logs')
            .select('*')
            .eq('user_id', user.id)
            .eq('log_date', dateISO)
            .maybeSingle(),
          supabase
            .from('workout_completions')
            .select('*')
            .eq('user_id', user.id)
            .eq('scheduled_date', dateISO)
            .order('sort_order'),
        ])
        setDailyLog((log as DailyLog | null) ?? null)
        const list = (rows as WorkoutCompletion[]) || []
        setItems(list)
        const nextDrafts: typeof drafts = {}
        list.forEach((r) => {
          nextDrafts[r.id] = {
            actual_sets: r.actual_sets != null ? String(r.actual_sets) : '',
            actual_reps: r.actual_reps != null ? String(r.actual_reps) : '',
            actual_weight: r.actual_weight != null ? String(r.actual_weight) : '',
            notes: r.notes || '',
          }
        })
        setDrafts(nextDrafts)
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
    setExpandedId(null)
    loadDate(next)
  }

  async function toggleItem(item: WorkoutCompletion) {
    setSavingId(item.id)
    try {
      const { data, error } = await supabase.rpc('update_workout_completion', {
        p_id: item.id,
        p_patch: { completed: !item.completed },
      })
      if (error) throw error
      setItems((prev) => prev.map((x) => (x.id === item.id ? (data as WorkoutCompletion) : x)))
    } catch (err: any) {
      toast.error(err.message || 'Failed to update')
    } finally {
      setSavingId(null)
    }
  }

  async function saveActuals(item: WorkoutCompletion) {
    const d = drafts[item.id]
    if (!d) return
    setSavingId(item.id)
    try {
      const { data, error } = await supabase.rpc('update_workout_completion', {
        p_id: item.id,
        p_patch: {
          actual_sets: d.actual_sets === '' ? '' : parseInt(d.actual_sets, 10),
          actual_reps: d.actual_reps === '' ? '' : parseInt(d.actual_reps, 10),
          actual_weight: d.actual_weight === '' ? '' : parseFloat(d.actual_weight),
          notes: d.notes,
        },
      })
      if (error) throw error
      setItems((prev) => prev.map((x) => (x.id === item.id ? (data as WorkoutCompletion) : x)))
      toast.success('Saved workout log')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save details')
    } finally {
      setSavingId(null)
    }
  }

  async function completeAll() {
    const pending = items.filter((i) => !i.completed)
    if (pending.length === 0) return
    setSavingId('all')
    try {
      const results = await Promise.all(
        pending.map((p) =>
          supabase.rpc('update_workout_completion', { p_id: p.id, p_patch: { completed: true } })
        )
      )
      const err = results.find((r) => r.error)?.error
      if (err) throw err
      const updatedMap = new Map<string, WorkoutCompletion>()
      results.forEach((r) => {
        if (r.data) updatedMap.set((r.data as WorkoutCompletion).id, r.data as WorkoutCompletion)
      })
      setItems((prev) => prev.map((x) => updatedMap.get(x.id) || x))
      toast.success('Workout completed!')
    } catch (err: any) {
      toast.error(err.message || 'Could not complete all')
    } finally {
      setSavingId(null)
    }
  }

  const completedCount = items.filter((c) => c.completed).length
  const totalCount = items.length
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const allDone = totalCount > 0 && completedCount === totalCount
  const isToday = selectedDate === todayISO

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-3xl space-y-4">
        <div className="skeleton h-8 w-56" />
        <div className="skeleton h-3 rounded-full" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-20 rounded-xl" />
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

        {/* Date Switcher */}
        {selectedDate && (
          <div className="flex items-center gap-1 bg-bg-card border border-border rounded-lg p-1">
            <button
              onClick={() => changeDate(-1)}
              className="p-1.5 text-text-secondary hover:text-text-primary rounded"
              title="Previous day"
            >
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
              title="Next day"
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
            {selectedDate ? `${weekdayNameFromISO(selectedDate)}'s Workout` : "Today's Workout"}
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            {dailyLog?.workout_title || 'No workout scheduled'}
            {selectedDate ? ` • ${formatPrettyDate(selectedDate)}` : ''}
          </p>
        </div>

        {totalCount > 0 && (
          <div className="text-right">
            <p className="text-2xl font-bold text-accent">{percentage}%</p>
            <p className="text-xs text-text-muted">
              {completedCount}/{totalCount} done
            </p>
          </div>
        )}
      </div>

      {totalCount > 0 && (
        <div className="space-y-3">
          <div className="h-2 bg-bg-hover rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
          </div>
          {!allDone && (
            <div className="flex justify-end">
              <button
                onClick={completeAll}
                disabled={savingId === 'all'}
                className="text-xs font-medium text-accent hover:text-accent-hover flex items-center gap-1"
              >
                <CheckCheck className="w-4 h-4" /> Mark whole workout complete
              </button>
            </div>
          )}
        </div>
      )}

      {allDone && (
        <div className="bg-accent-muted border border-accent/30 rounded-xl p-5 text-center">
          <Trophy className="w-8 h-8 text-accent mx-auto mb-2" />
          <h3 className="text-base font-semibold text-accent">Workout Complete!</h3>
          <p className="text-text-secondary text-xs mt-1">
            Recorded permanently for {selectedDate}. Next week starts fresh automatically.
          </p>
        </div>
      )}

      {/* Checklist Content */}
      {!dailyLog?.workout_plan_id && items.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-2xl p-10 text-center">
          <Dumbbell className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-1">
            {isToday ? 'No active workout plan' : 'No workout recorded for this day'}
          </h3>
          <p className="text-text-muted text-sm mb-5">
            {isToday
              ? 'Activate one of your workout plans or apply a premade plan to generate daily checklists.'
              : 'No schedule was active on this date.'}
          </p>
          {isToday && (
            <div className="flex justify-center gap-3">
              <Link to="/workouts" className="bg-accent hover:bg-accent-hover text-black font-semibold px-5 py-2 rounded-lg text-sm">
                My Workout Plans
              </Link>
              <Link to="/plans" className="border border-border hover:border-border-light px-5 py-2 rounded-lg text-sm">
                Browse Library
              </Link>
            </div>
          )}
        </div>
      ) : dailyLog?.workout_is_rest && items.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-2xl p-10 text-center">
          <h3 className="text-lg font-semibold mb-1">Rest & Recovery Day</h3>
          <p className="text-text-muted text-sm">
            No exercises scheduled today. Rest days keep your streak intact.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const expanded = expandedId === item.id
            const draft = drafts[item.id] || { actual_sets: '', actual_reps: '', actual_weight: '', notes: '' }
            return (
              <div
                key={item.id}
                className={`bg-bg-card border rounded-xl transition-colors ${
                  item.completed ? 'border-accent/30 bg-accent/5' : 'border-border'
                }`}
              >
                <div className="p-4 flex items-center gap-3">
                  <button
                    onClick={() => toggleItem(item)}
                    disabled={savingId === item.id}
                    className="flex-shrink-0"
                    aria-label={item.completed ? 'Undo completion' : 'Mark completed'}
                  >
                    {savingId === item.id ? (
                      <Loader2 className="w-6 h-6 text-accent animate-spin" />
                    ) : item.completed ? (
                      <CheckCircle2 className="w-6 h-6 text-accent" />
                    ) : (
                      <Circle className="w-6 h-6 text-text-muted hover:text-accent transition-colors" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${item.completed ? 'line-through text-text-muted' : ''}`}>
                      {item.exercise_name}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      Target: {item.target_sets ?? '-'} sets × {item.target_reps ?? '-'} reps
                      {item.target_weight != null ? ` @ ${item.target_weight}${unit}` : ''}
                      {(item.actual_weight != null || item.actual_reps != null) && (
                        <span className="text-accent ml-2">
                          • Logged: {item.actual_sets ?? item.target_sets ?? '-'}×{item.actual_reps ?? item.target_reps ?? '-'}
                          {item.actual_weight != null ? ` @ ${item.actual_weight}${unit}` : ''}
                        </span>
                      )}
                    </p>
                  </div>

                  <button
                    onClick={() => setExpandedId(expanded ? null : item.id)}
                    className="text-text-muted hover:text-text-primary p-1"
                    title="Log actual sets, reps, weight, or notes"
                  >
                    {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>

                {expanded && (
                  <div className="px-4 pb-4 pt-3 border-t border-border space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-text-muted">Actual Sets</label>
                        <input
                          type="number"
                          min={0}
                          value={draft.actual_sets}
                          onChange={(e) =>
                            setDrafts((p) => ({ ...p, [item.id]: { ...draft, actual_sets: e.target.value } }))
                          }
                          className="w-full bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
                          placeholder={String(item.target_sets ?? '')}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-text-muted">Actual Reps</label>
                        <input
                          type="number"
                          min={0}
                          value={draft.actual_reps}
                          onChange={(e) =>
                            setDrafts((p) => ({ ...p, [item.id]: { ...draft, actual_reps: e.target.value } }))
                          }
                          className="w-full bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
                          placeholder={String(item.target_reps ?? '')}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-text-muted">Actual Weight ({unit})</label>
                        <input
                          type="number"
                          step="0.5"
                          min={0}
                          value={draft.actual_weight}
                          onChange={(e) =>
                            setDrafts((p) => ({ ...p, [item.id]: { ...draft, actual_weight: e.target.value } }))
                          }
                          className="w-full bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
                          placeholder={item.target_weight != null ? String(item.target_weight) : unit}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-text-muted">Workout Notes</label>
                      <input
                        value={draft.notes}
                        onChange={(e) =>
                          setDrafts((p) => ({ ...p, [item.id]: { ...draft, notes: e.target.value } }))
                        }
                        className="w-full bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
                        placeholder="Form cues, RPE, energy level..."
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => saveActuals(item)}
                        disabled={savingId === item.id}
                        className="bg-accent hover:bg-accent-hover text-black font-semibold text-xs px-4 py-1.5 rounded-lg disabled:opacity-50"
                      >
                        Save Log
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
