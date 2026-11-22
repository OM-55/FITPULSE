import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { weightUnit } from '../lib/date'
import WorkoutPlanEditor, { buildEmptyWorkoutDays, type WorkoutPlanFormData } from '../components/WorkoutPlanEditor'
import DietPlanEditor, { buildEmptyDietDays, type DietPlanFormData } from '../components/DietPlanEditor'
import toast from 'react-hot-toast'
import { Shield, Plus, Trash2, Edit3, Dumbbell, UtensilsCrossed, Eye, EyeOff, Calendar } from 'lucide-react'
import type { WorkoutPlan, DietPlan } from '../types/database'

export default function AdminPage() {
  const { profile, isAdmin } = useAuth()
  const [tab, setTab] = useState<'workout' | 'diet'>('workout')
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([])
  const [dietPlans, setDietPlans] = useState<DietPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [workoutEditor, setWorkoutEditor] = useState<WorkoutPlanFormData | null>(null)
  const [dietEditor, setDietEditor] = useState<DietPlanFormData | null>(null)
  const unit = weightUnit(profile?.preferred_units)

  const loadPlans = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: wp }, { data: dp }] = await Promise.all([
        supabase.from('workout_plans').select('*').eq('is_premade', true).order('updated_at', { ascending: false }),
        supabase.from('diet_plans').select('*').eq('is_premade', true).order('updated_at', { ascending: false }),
      ])
      setWorkoutPlans((wp as WorkoutPlan[]) || [])
      setDietPlans((dp as DietPlan[]) || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) loadPlans()
  }, [isAdmin, loadPlans])

  function startCreate() {
    if (tab === 'workout') {
      setWorkoutEditor({
        name: '',
        description: '',
        duration_days: 7,
        difficulty: 'Intermediate',
        category: 'Hypertrophy',
        equipment: '',
        visibility: 'public',
        is_premade: true,
        days: buildEmptyWorkoutDays(7),
      })
    } else {
      setDietEditor({
        name: '',
        description: '',
        duration_days: 7,
        difficulty: 'Beginner',
        category: 'High Protein',
        visibility: 'public',
        is_premade: true,
        days: buildEmptyDietDays(7),
      })
    }
  }

  async function startEditWorkout(plan: WorkoutPlan) {
    setLoading(true)
    try {
      const { data: daysData, error } = await supabase
        .from('workout_days')
        .select('*, exercises:workout_exercises(*)')
        .eq('plan_id', plan.id)
        .order('weekday')
      if (error) throw error

      const map = new Map<number, any>()
      ;(daysData || []).forEach((d: any) => map.set(d.weekday, d))
      const days = buildEmptyWorkoutDays(plan.duration_days).map((empty) => {
        const found = map.get(empty.weekday)
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

      setWorkoutEditor({
        id: plan.id,
        name: plan.name,
        description: plan.description || '',
        duration_days: plan.duration_days,
        difficulty: plan.difficulty || 'Intermediate',
        category: plan.category || '',
        equipment: plan.equipment || '',
        visibility: plan.visibility,
        is_premade: true,
        days,
      })
    } catch (err: any) {
      toast.error(err.message || 'Could not load plan')
    } finally {
      setLoading(false)
    }
  }

  async function startEditDiet(plan: DietPlan) {
    setLoading(true)
    try {
      const { data: daysData, error } = await supabase
        .from('diet_days')
        .select('*, meals:diet_meals(*, items:meal_items(*))')
        .eq('plan_id', plan.id)
        .order('weekday')
      if (error) throw error

      const map = new Map<number, any>()
      ;(daysData || []).forEach((d: any) => map.set(d.weekday, d))
      const days = buildEmptyDietDays(plan.duration_days).map((empty) => {
        const found = map.get(empty.weekday)
        if (!found) return empty
        return {
          id: found.id,
          weekday: found.weekday,
          title: found.title,
          meals: (found.meals || [])
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((m: any) => ({
              id: m.id,
              meal_name: m.meal_name,
              scheduled_time: m.scheduled_time ? String(m.scheduled_time).slice(0, 5) : '',
              notes: m.notes || '',
              items: (m.items || [])
                .sort((a: any, b: any) => a.sort_order - b.sort_order)
                .map((it: any) => ({
                  food_name: it.food_name,
                  quantity: it.quantity || '',
                  calories: it.calories != null ? Number(it.calories) : null,
                  protein: it.protein != null ? Number(it.protein) : null,
                  carbohydrates: it.carbohydrates != null ? Number(it.carbohydrates) : null,
                  fats: it.fats != null ? Number(it.fats) : null,
                })),
            })),
        }
      })

      setDietEditor({
        id: plan.id,
        name: plan.name,
        description: plan.description || '',
        duration_days: plan.duration_days,
        difficulty: plan.difficulty || 'Beginner',
        category: plan.category || '',
        visibility: plan.visibility,
        is_premade: true,
        days,
      })
    } catch (err: any) {
      toast.error(err.message || 'Could not load plan')
    } finally {
      setLoading(false)
    }
  }

  async function togglePublish(type: 'workout' | 'diet', plan: WorkoutPlan | DietPlan) {
    const nextVis = plan.visibility === 'public' ? 'private' : 'public'
    const table = type === 'workout' ? 'workout_plans' : 'diet_plans'
    const { error } = await supabase.from(table).update({ visibility: nextVis }).eq('id', plan.id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(nextVis === 'public' ? 'Plan published' : 'Plan unpublished')
    await loadPlans()
  }

  async function deletePremade(type: 'workout' | 'diet', id: string) {
    if (!confirm('Delete this premade plan? Users who already copied it keep their own copies.')) return
    const { error } = await supabase.rpc('delete_plan', { p_kind: type, p_plan_id: id })
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Premade plan deleted')
    await loadPlans()
  }

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <Shield className="w-12 h-12 text-text-muted mx-auto mb-3" />
        <h2 className="text-xl font-bold">Administrator Access Required</h2>
        <p className="text-sm text-text-muted mt-1">Database RLS enforces admin permissions server-side.</p>
      </div>
    )
  }

  if (workoutEditor) {
    return (
      <div className="p-4 md:p-6">
        <WorkoutPlanEditor
          initialData={workoutEditor}
          unitLabel={unit}
          isPremadeMode
          onCancel={() => setWorkoutEditor(null)}
          onSaved={async () => {
            setWorkoutEditor(null)
            await loadPlans()
          }}
        />
      </div>
    )
  }

  if (dietEditor) {
    return (
      <div className="p-4 md:p-6">
        <DietPlanEditor
          initialData={dietEditor}
          isPremadeMode
          onCancel={() => setDietEditor(null)}
          onSaved={async () => {
            setDietEditor(null)
            await loadPlans()
          }}
        />
      </div>
    )
  }

  const list = tab === 'workout' ? workoutPlans : dietPlans

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-warning" /> Admin Dashboard
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Create, edit, publish, and manage official premade workout and diet plans.
          </p>
        </div>
        <button
          onClick={startCreate}
          className="bg-accent hover:bg-accent-hover text-black font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 text-sm"
        >
          <Plus className="w-4 h-4" /> New Premade {tab === 'workout' ? 'Workout' : 'Diet'}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('workout')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'workout' ? 'bg-accent text-black' : 'bg-bg-card border border-border text-text-secondary'
          }`}
        >
          <Dumbbell className="w-4 h-4" /> Workout Plans ({workoutPlans.length})
        </button>
        <button
          onClick={() => setTab('diet')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'diet' ? 'bg-accent text-black' : 'bg-bg-card border border-border text-text-secondary'
          }`}
        >
          <UtensilsCrossed className="w-4 h-4" /> Diet Plans ({dietPlans.length})
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-10 text-center text-sm text-text-muted">
          No premade {tab} plans yet. Click "New Premade" to author one.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((p) => (
            <div
              key={p.id}
              className="bg-bg-card border border-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{p.name}</h3>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      p.visibility === 'public'
                        ? 'bg-accent-muted text-accent'
                        : 'bg-bg-hover text-text-muted'
                    }`}
                  >
                    {p.visibility === 'public' ? 'Published' : 'Draft'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {p.duration_days} days
                  </span>
                  {p.difficulty && <span>{p.difficulty}</span>}
                  {p.category && <span>• {p.category}</span>}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => togglePublish(tab, p)}
                  className="p-2 rounded-lg text-text-muted hover:text-accent hover:bg-bg-hover"
                  title={p.visibility === 'public' ? 'Unpublish' : 'Publish'}
                >
                  {p.visibility === 'public' ? <Eye className="w-4 h-4 text-accent" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => (tab === 'workout' ? startEditWorkout(p as WorkoutPlan) : startEditDiet(p as DietPlan))}
                  className="p-2 rounded-lg text-text-muted hover:text-accent hover:bg-bg-hover"
                  title="Edit days & items"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deletePremade(tab, p.id)}
                  className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-bg-hover"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
