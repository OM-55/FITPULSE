import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { DIFFICULTY_LEVELS } from '../lib/constants'
import { weightUnit } from '../lib/date'
import PlanPreviewModal from '../components/PlanPreviewModal'
import toast from 'react-hot-toast'
import {
  Dumbbell, UtensilsCrossed, Download, Eye, EyeOff, Loader2, Calendar, Shield, Search, Copy
} from 'lucide-react'
import type { WorkoutPlan, DietPlan } from '../types/database'

export default function PlansPage() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState<'workout' | 'diet'>('workout')
  const [difficultyFilter, setDifficultyFilter] = useState<string>('All')
  const [search, setSearch] = useState('')
  const [premadeWorkouts, setPremadeWorkouts] = useState<WorkoutPlan[]>([])
  const [premadeDiets, setPremadeDiets] = useState<DietPlan[]>([])
  const [userWorkouts, setUserWorkouts] = useState<WorkoutPlan[]>([])
  const [userDiets, setUserDiets] = useState<DietPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ plan: WorkoutPlan | DietPlan; type: 'workout' | 'diet' } | null>(null)
  const unit = weightUnit(profile?.preferred_units)

  const loadPlans = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [{ data: pw }, { data: pd }, { data: uw }, { data: ud }] = await Promise.all([
        supabase.from('workout_plans').select('*').eq('is_premade', true).eq('visibility', 'public').order('created_at'),
        supabase.from('diet_plans').select('*').eq('is_premade', true).eq('visibility', 'public').order('created_at'),
        supabase
          .from('workout_plans')
          .select('*')
          .eq('owner_id', user.id)
          .eq('is_premade', false)
          .order('updated_at', { ascending: false }),
        supabase
          .from('diet_plans')
          .select('*')
          .eq('owner_id', user.id)
          .eq('is_premade', false)
          .order('updated_at', { ascending: false }),
      ])
      setPremadeWorkouts((pw as WorkoutPlan[]) || [])
      setPremadeDiets((pd as DietPlan[]) || [])
      setUserWorkouts((uw as WorkoutPlan[]) || [])
      setUserDiets((ud as DietPlan[]) || [])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadPlans()
  }, [loadPlans])

  async function copyPlan(type: 'workout' | 'diet', planId: string, activate: boolean) {
    setApplyingId(planId)
    try {
      const fn = type === 'workout' ? 'copy_workout_plan' : 'copy_diet_plan'
      const { error } = await supabase.rpc(fn, { p_source: planId, p_activate: activate })
      if (error) throw error
      toast.success(activate ? 'Plan copied & set as active!' : 'Editable copy saved to your plans!')
      setPreview(null)
      await loadPlans()
    } catch (err: any) {
      toast.error(err.message || 'Failed to apply plan')
    } finally {
      setApplyingId(null)
    }
  }

  async function toggleVisibility(type: 'workout' | 'diet', plan: WorkoutPlan | DietPlan) {
    const nextVis = plan.visibility === 'public' ? 'private' : 'public'
    try {
      const table = type === 'workout' ? 'workout_plans' : 'diet_plans'
      const { error } = await supabase.from(table).update({ visibility: nextVis }).eq('id', plan.id)
      if (error) throw error
      toast.success(`Plan is now ${nextVis}`)
      await loadPlans()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update visibility')
    }
  }

  function filterList<T extends WorkoutPlan | DietPlan>(list: T[]): T[] {
    return list.filter((p) => {
      if (difficultyFilter !== 'All' && p.difficulty !== difficultyFilter) return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const hay = `${p.name} ${p.description || ''} ${p.category || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }

  const premadeList = filterList(tab === 'workout' ? premadeWorkouts : premadeDiets)
  const myList = filterList(tab === 'workout' ? userWorkouts : userDiets)

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Plan Library</h1>
        <p className="text-text-secondary text-sm mt-1">
          Browse curated premade plans or manage your saved templates. Applying creates your own editable copy.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('workout')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'workout' ? 'bg-accent text-black' : 'bg-bg-card border border-border text-text-secondary'
            }`}
          >
            <Dumbbell className="w-4 h-4" /> Workouts
          </button>
          <button
            onClick={() => setTab('diet')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'diet' ? 'bg-accent text-black' : 'bg-bg-card border border-border text-text-secondary'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" /> Diets
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter plans..."
              className="bg-bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-accent w-48"
            />
          </div>
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="bg-bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          >
            <option value="All">All levels</option>
            {DIFFICULTY_LEVELS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-40 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Premade Plans */}
          <section>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent" /> Premade {tab === 'workout' ? 'Workout' : 'Diet'} Plans
            </h2>
            {premadeList.length === 0 ? (
              <div className="bg-bg-card border border-border rounded-xl p-8 text-center text-sm text-text-muted">
                No premade {tab} plans match your filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {premadeList.map((plan) => (
                  <div
                    key={plan.id}
                    className="bg-bg-card border border-border rounded-xl p-5 flex flex-col justify-between hover:border-border-light transition-colors"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="font-semibold text-base">{plan.name}</h3>
                        <span className="text-[11px] bg-accent-muted text-accent px-2 py-0.5 rounded-full font-medium">
                          Official
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted mb-2.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {plan.duration_days} days
                        </span>
                        {plan.difficulty && <span>• {plan.difficulty}</span>}
                        {plan.category && <span>• {plan.category}</span>}
                      </div>
                      {plan.description && (
                        <p className="text-sm text-text-secondary line-clamp-2 mb-3">{plan.description}</p>
                      )}
                      {'equipment' in plan && typeof plan.equipment === 'string' && plan.equipment && (
                        <p className="text-xs text-text-muted mb-3">Equipment: {plan.equipment}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-border">
                      <button
                        onClick={() => setPreview({ plan, type: tab })}
                        className="border border-border hover:border-border-light px-3 py-1.5 rounded-lg text-xs font-medium"
                      >
                        Inspect
                      </button>
                      <button
                        onClick={() => copyPlan(tab, plan.id, true)}
                        disabled={applyingId === plan.id}
                        className="flex-1 bg-accent hover:bg-accent-hover text-black font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {applyingId === plan.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        Apply Plan
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* My Saved Plans */}
          <section>
            <h2 className="text-base font-semibold mb-3">My Saved {tab === 'workout' ? 'Workout' : 'Diet'} Plans</h2>
            {myList.length === 0 ? (
              <div className="bg-bg-card border border-border rounded-xl p-8 text-center text-sm text-text-muted">
                You don't have any personal {tab} plans matching these filters yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myList.map((plan) => (
                  <div
                    key={plan.id}
                    className="bg-bg-card border border-border rounded-xl p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="font-semibold text-base">{plan.name}</h3>
                        <button
                          onClick={() => toggleVisibility(tab, plan)}
                          className="text-xs flex items-center gap-1 px-2 py-0.5 rounded bg-bg-hover text-text-secondary hover:text-text-primary"
                          title="Toggle public visibility"
                        >
                          {plan.visibility === 'public' ? (
                            <>
                              <Eye className="w-3 h-3 text-accent" /> Public
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3" /> Private
                            </>
                          )}
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted mb-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {plan.duration_days} days
                        </span>
                        {plan.difficulty && <span>• {plan.difficulty}</span>}
                        {plan.category && <span>• {plan.category}</span>}
                      </div>
                      {plan.description && (
                        <p className="text-sm text-text-secondary line-clamp-2">{plan.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-border mt-3">
                      <button
                        onClick={() => setPreview({ plan, type: tab })}
                        className="border border-border hover:border-border-light px-3 py-1.5 rounded-lg text-xs font-medium"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => copyPlan(tab, plan.id, false)}
                        disabled={applyingId === plan.id}
                        className="border border-border hover:border-accent text-text-secondary hover:text-accent px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" /> Duplicate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {preview && (
        <PlanPreviewModal
          plan={preview.plan}
          type={preview.type}
          unitLabel={unit}
          copying={applyingId === preview.plan.id}
          onClose={() => setPreview(null)}
          onCopy={(activate) => copyPlan(preview.type, preview.plan.id, activate)}
        />
      )}
    </div>
  )
}
