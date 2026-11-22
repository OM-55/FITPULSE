import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { weightUnit } from '../lib/date'
import WorkoutPlanEditor, { buildEmptyWorkoutDays, type WorkoutPlanFormData } from '../components/WorkoutPlanEditor'
import PlanPreviewModal from '../components/PlanPreviewModal'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Edit3, Check, Dumbbell, Copy, Calendar, Eye, EyeOff, Play, Search
} from 'lucide-react'
import type { WorkoutPlan } from '../types/database'

export default function WorkoutsPage() {
  const { user, profile } = useAuth()
  const [plans, setPlans] = useState<WorkoutPlan[]>([])
  const [activePlanId, setActivePlanId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editorData, setEditorData] = useState<WorkoutPlanFormData | null>(null)
  const [previewPlan, setPreviewPlan] = useState<WorkoutPlan | null>(null)
  const unitLabel = weightUnit(profile?.preferred_units)

  const loadPlans = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [{ data: plansData }, { data: activeData }] = await Promise.all([
        supabase
          .from('workout_plans')
          .select('*')
          .eq('owner_id', user.id)
          .eq('is_premade', false)
          .order('updated_at', { ascending: false }),
        supabase
          .from('user_active_plans')
          .select('workout_plan_id')
          .eq('user_id', user.id)
          .maybeSingle(),
      ])
      setPlans((plansData as WorkoutPlan[]) || [])
      setActivePlanId(activeData?.workout_plan_id || null)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadPlans()
  }, [loadPlans])

  function startCreate() {
    setEditorData({
      name: '',
      description: '',
      duration_days: 7,
      difficulty: 'Intermediate',
      category: '',
      equipment: '',
      visibility: 'private',
      days: buildEmptyWorkoutDays(7),
    })
  }

  async function startEdit(plan: WorkoutPlan) {
    setLoading(true)
    try {
      const { data: daysData, error } = await supabase
        .from('workout_days')
        .select('*, exercises:workout_exercises(*)')
        .eq('plan_id', plan.id)
        .order('weekday')
      if (error) throw error

      const daysMap = new Map<number, any>()
      ;(daysData || []).forEach((d: any) => daysMap.set(d.weekday, d))

      const fullDays = buildEmptyWorkoutDays(plan.duration_days).map((empty) => {
        const found = daysMap.get(empty.weekday)
        if (!found) return empty
        return {
          id: found.id,
          weekday: found.weekday,
          title: found.title,
          is_rest_day: found.is_rest_day,
          exercises: (found.exercises || [])
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((e: any) => ({
              id: e.id,
              exercise_name: e.exercise_name,
              sets: e.sets,
              reps: e.reps,
              target_weight: e.target_weight != null ? Number(e.target_weight) : null,
              rest_seconds: e.rest_seconds,
              instructions: e.instructions || '',
              notes: e.notes || '',
            })),
        }
      })

      setEditorData({
        id: plan.id,
        name: plan.name,
        description: plan.description || '',
        duration_days: plan.duration_days,
        difficulty: plan.difficulty || 'Intermediate',
        category: plan.category || '',
        equipment: plan.equipment || '',
        visibility: plan.visibility,
        days: fullDays,
      })
    } catch (err: any) {
      toast.error(err.message || 'Could not load plan')
    } finally {
      setLoading(false)
    }
  }

  async function handleSetActive(planId: string | null) {
    try {
      const { error } = await supabase.rpc('set_active_plan', {
        p_kind: 'workout',
        p_plan_id: planId,
      })
      if (error) throw error
      setActivePlanId(planId)
      toast.success(planId ? 'Workout plan activated!' : 'Workout plan deactivated')
    } catch (err: any) {
      toast.error(err.message || 'Failed to update active plan')
    }
  }

  async function handleDuplicate(planId: string) {
    try {
      const { error } = await supabase.rpc('copy_workout_plan', {
        p_source: planId,
        p_activate: false,
      })
      if (error) throw error
      toast.success('Plan duplicated!')
      await loadPlans()
    } catch (err: any) {
      toast.error(err.message || 'Failed to duplicate')
    }
  }

  async function handleToggleVisibility(plan: WorkoutPlan) {
    const nextVis = plan.visibility === 'public' ? 'private' : 'public'
    try {
      const { error } = await supabase
        .from('workout_plans')
        .update({ visibility: nextVis })
        .eq('id', plan.id)
      if (error) throw error
      toast.success(`Plan is now ${nextVis}`)
      await loadPlans()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update visibility')
    }
  }

  async function handleDelete(planId: string) {
    if (!confirm('Delete this workout plan? Your past completion history will remain intact.')) return
    try {
      const { error } = await supabase.rpc('delete_plan', {
        p_kind: 'workout',
        p_plan_id: planId,
      })
      if (error) throw error
      toast.success('Workout plan deleted')
      await loadPlans()
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete plan')
    }
  }

  if (editorData) {
    return (
      <div className="p-4 md:p-6">
        <WorkoutPlanEditor
          initialData={editorData}
          unitLabel={unitLabel}
          onCancel={() => setEditorData(null)}
          onSaved={async (savedId) => {
            if (!activePlanId && !editorData.id) {
              await supabase.rpc('set_active_plan', { p_kind: 'workout', p_plan_id: savedId })
            }
            setEditorData(null)
            await loadPlans()
          }}
        />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Workout Plans</h1>
          <p className="text-text-secondary text-sm mt-1">
            Create recurring 5, 6, or 7-day schedules. Weekly templates repeat automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/workouts/today"
            className="border border-border hover:border-accent text-text-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
          >
            <Play className="w-4 h-4 text-accent" /> Today's Checklist
          </Link>
          <button
            onClick={startCreate}
            className="bg-accent hover:bg-accent-hover text-black font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Plan
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-44 rounded-xl" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-2xl p-12 text-center">
          <Dumbbell className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-1">No workout plans yet</h3>
          <p className="text-text-muted text-sm mb-5">
            Build your own recurring weekly split or copy a premade plan from the library.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={startCreate}
              className="bg-accent hover:bg-accent-hover text-black font-semibold px-5 py-2.5 rounded-lg text-sm"
            >
              Create Workout Plan
            </button>
            <Link
              to="/plans"
              className="border border-border hover:border-border-light text-text-primary px-5 py-2.5 rounded-lg text-sm font-medium"
            >
              Browse Premade Plans
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map((plan) => {
            const isActive = activePlanId === plan.id
            return (
              <div
                key={plan.id}
                className={`bg-bg-card border rounded-xl p-5 flex flex-col justify-between transition-colors ${
                  isActive ? 'border-accent/60' : 'border-border'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-base truncate">{plan.name}</h3>
                        {isActive && (
                          <span className="text-[11px] font-semibold bg-accent-muted text-accent px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {plan.duration_days}d/week
                        </span>
                        {plan.difficulty && <span>• {plan.difficulty}</span>}
                        {plan.category && <span>• {plan.category}</span>}
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleVisibility(plan)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover"
                      title={plan.visibility === 'public' ? 'Public — click to make private' : 'Private — click to publish'}
                    >
                      {plan.visibility === 'public' ? (
                        <Eye className="w-4 h-4 text-accent" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {plan.description && (
                    <p className="text-sm text-text-secondary line-clamp-2 mb-4">{plan.description}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border mt-3">
                  {isActive ? (
                    <button
                      onClick={() => handleSetActive(null)}
                      className="text-xs text-text-muted hover:text-text-secondary px-2.5 py-1.5 rounded-lg border border-border"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSetActive(plan.id)}
                      className="bg-accent hover:bg-accent-hover text-black font-semibold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> Set Active
                    </button>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPreviewPlan(plan)}
                      className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-bg-hover"
                      title="Preview"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => startEdit(plan)}
                      className="p-1.5 text-text-muted hover:text-accent rounded-lg hover:bg-bg-hover"
                      title="Edit plan"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDuplicate(plan.id)}
                      className="p-1.5 text-text-muted hover:text-accent rounded-lg hover:bg-bg-hover"
                      title="Duplicate plan"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(plan.id)}
                      className="p-1.5 text-text-muted hover:text-danger rounded-lg hover:bg-bg-hover"
                      title="Delete plan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {previewPlan && (
        <PlanPreviewModal
          plan={previewPlan}
          type="workout"
          unitLabel={unitLabel}
          onClose={() => setPreviewPlan(null)}
        />
      )}
    </div>
  )
}
