import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { WEEKDAYS } from '../lib/constants'
import { formatTime12h } from '../lib/date'
import { X, Dumbbell, UtensilsCrossed, Calendar, Loader2, Download, Check, Clock } from 'lucide-react'
import type { WorkoutPlan, DietPlan } from '../types/database'

interface PlanPreviewModalProps {
  plan: WorkoutPlan | DietPlan
  type: 'workout' | 'diet'
  unitLabel?: 'kg' | 'lb'
  onClose: () => void
  onCopy?: (activate: boolean) => Promise<void>
  copying?: boolean
}

export default function PlanPreviewModal({
  plan,
  type,
  unitLabel = 'kg',
  onClose,
  onCopy,
  copying = false,
}: PlanPreviewModalProps) {
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState<any[]>([])
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        if (type === 'workout') {
          const { data } = await supabase
            .from('workout_days')
            .select('*, exercises:workout_exercises(*)')
            .eq('plan_id', plan.id)
            .order('weekday')
          if (mounted) {
            const sorted = (data || []).map((d: any) => ({
              ...d,
              exercises: (d.exercises || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
            }))
            setDays(sorted)
          }
        } else {
          const { data } = await supabase
            .from('diet_days')
            .select('*, meals:diet_meals(*, items:meal_items(*))')
            .eq('plan_id', plan.id)
            .order('weekday')
          if (mounted) {
            const sorted = (data || []).map((d: any) => ({
              ...d,
              meals: (d.meals || [])
                .sort((a: any, b: any) => a.sort_order - b.sort_order)
                .map((m: any) => ({
                  ...m,
                  items: (m.items || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
                })),
            }))
            setDays(sorted)
          }
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [plan.id, type])

  const selectedDay = days[activeIdx]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-secondary border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                type === 'workout' ? 'bg-accent-muted text-accent' : 'bg-blue-500/10 text-blue-400'
              }`}
            >
              {type === 'workout' ? <Dumbbell className="w-5 h-5" /> : <UtensilsCrossed className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold truncate">{plan.name}</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {plan.duration_days}-day schedule
                </span>
                {plan.difficulty && <span className="px-2 py-0.5 bg-bg-hover rounded">{plan.difficulty}</span>}
                {plan.category && <span className="px-2 py-0.5 bg-bg-hover rounded">{plan.category}</span>}
                {'equipment' in plan && plan.equipment && (
                  <span className="text-text-secondary">• {plan.equipment}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary p-1 rounded-lg"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {plan.description && <p className="text-sm text-text-secondary leading-relaxed">{plan.description}</p>}

          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
            </div>
          ) : days.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-sm">No days configured in this plan yet.</div>
          ) : (
            <>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {days.map((d, i) => (
                  <button
                    key={d.id || i}
                    onClick={() => setActiveIdx(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      activeIdx === i
                        ? 'bg-accent text-black'
                        : 'bg-bg-card border border-border text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {WEEKDAYS[d.weekday]?.slice(0, 3) || `Day ${i + 1}`}
                    {type === 'workout' && d.is_rest_day ? ' (Rest)' : ''}
                  </button>
                ))}
              </div>

              {selectedDay && (
                <div className="bg-bg-card border border-border rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold text-sm">
                    {WEEKDAYS[selectedDay.weekday]} — {selectedDay.title || (selectedDay.is_rest_day ? 'Rest Day' : 'Scheduled')}
                  </h3>

                  {type === 'workout' ? (
                    selectedDay.is_rest_day ? (
                      <p className="text-sm text-text-muted py-4 text-center">Designated Rest Day</p>
                    ) : selectedDay.exercises?.length === 0 ? (
                      <p className="text-sm text-text-muted py-4 text-center">No exercises listed for this day.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedDay.exercises.map((ex: any, idx: number) => (
                          <div key={ex.id || idx} className="bg-bg-primary border border-border rounded-lg p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-sm">{ex.exercise_name}</span>
                              <span className="text-xs text-accent font-medium whitespace-nowrap">
                                {ex.sets} × {ex.reps}
                                {ex.target_weight ? ` @ ${ex.target_weight}${unitLabel}` : ''}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-text-muted mt-1">
                              {ex.rest_seconds ? <span>Rest: {ex.rest_seconds}s</span> : null}
                              {ex.instructions ? <span>{ex.instructions}</span> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : selectedDay.meals?.length === 0 ? (
                    <p className="text-sm text-text-muted py-4 text-center">No meals listed for this day.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedDay.meals.map((meal: any, idx: number) => (
                        <div key={meal.id || idx} className="bg-bg-primary border border-border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-medium text-sm">{meal.meal_name}</span>
                            {meal.scheduled_time && (
                              <span className="text-xs text-text-muted flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {formatTime12h(meal.scheduled_time)}
                              </span>
                            )}
                          </div>
                          {meal.items?.length > 0 && (
                            <ul className="space-y-1">
                              {meal.items.map((it: any, ii: number) => (
                                <li key={it.id || ii} className="flex items-center justify-between text-xs text-text-secondary">
                                  <span>
                                    {it.food_name}
                                    {it.quantity ? ` — ${it.quantity}` : ''}
                                  </span>
                                  {it.calories != null && (
                                    <span className="text-text-muted">
                                      {it.calories} kcal{it.protein != null ? ` • ${it.protein}g P` : ''}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                          {meal.notes && <p className="text-xs text-text-muted mt-1.5 italic">{meal.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {onCopy && (
          <div className="p-4 border-t border-border bg-bg-primary/60 flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => onCopy(false)}
              disabled={copying}
              className="border border-border hover:border-border-light text-text-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
            >
              {copying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Save a Copy
            </button>
            <button
              onClick={() => onCopy(true)}
              disabled={copying}
              className="bg-accent hover:bg-accent-hover text-black px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              {copying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Apply & Activate
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
