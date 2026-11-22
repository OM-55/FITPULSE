import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Avatar from '../components/Avatar'
import PlanPreviewModal from '../components/PlanPreviewModal'
import toast from 'react-hot-toast'
import {
  Search, Users, Dumbbell, UtensilsCrossed, Calendar, Zap, ArrowLeft, Loader2
} from 'lucide-react'
import { APP_NAME } from '../lib/constants'
import type { SearchProfileResult, WorkoutPlan, DietPlan } from '../types/database'

export default function ExplorePage() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SearchProfileResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  const [premadeWorkouts, setPremadeWorkouts] = useState<WorkoutPlan[]>([])
  const [premadeDiets, setPremadeDiets] = useState<DietPlan[]>([])
  const [preview, setPreview] = useState<{ plan: WorkoutPlan | DietPlan; type: 'workout' | 'diet' } | null>(null)
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    async function loadPremade() {
      const [{ data: wp }, { data: dp }] = await Promise.all([
        supabase.from('workout_plans').select('*').eq('is_premade', true).eq('visibility', 'public').order('created_at'),
        supabase.from('diet_plans').select('*').eq('is_premade', true).eq('visibility', 'public').order('created_at'),
      ])
      setPremadeWorkouts((wp as WorkoutPlan[]) || [])
      setPremadeDiets((dp as DietPlan[]) || [])
    }
    loadPremade()
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setHasSearched(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc('search_profiles', { p_query: trimmed })
      if (!error) setResults((data as SearchProfileResult[]) || [])
      setHasSearched(true)
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  async function handleCopy(activate: boolean) {
    if (!preview || !user) return
    setCopying(true)
    try {
      const fn = preview.type === 'workout' ? 'copy_workout_plan' : 'copy_diet_plan'
      const { error } = await supabase.rpc(fn, { p_source: preview.plan.id, p_activate: activate })
      if (error) throw error
      toast.success(activate ? 'Plan copied & activated!' : 'Plan copied to your library!')
      setPreview(null)
    } catch (err: any) {
      toast.error(err.message || 'Failed to copy plan')
    } finally {
      setCopying(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <Link
            to={user ? '/dashboard' : '/'}
            className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary"
          >
            <ArrowLeft className="w-4 h-4" /> {user ? 'Back to Dashboard' : `Back to ${APP_NAME}`}
          </Link>
          {!user && (
            <div className="flex items-center gap-2">
              <Link to="/login" className="text-sm text-text-secondary hover:text-text-primary px-3 py-1.5">
                Login
              </Link>
              <Link to="/register" className="text-sm font-semibold bg-accent text-black px-3.5 py-1.5 rounded-lg">
                Sign Up
              </Link>
            </div>
          )}
        </div>

        {/* User Search */}
        <section className="bg-bg-card border border-border rounded-2xl p-6 space-y-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-accent" /> Find Athletes by Username
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              Search public profiles to view their shared workout and diet plans. Private accounts are never listed.
            </p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username or display name (min 2 chars)..."
              className="w-full bg-bg-primary border border-border rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-accent"
            />
            {searching && <Loader2 className="w-4 h-4 text-accent animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />}
          </div>

          {hasSearched && (
            <div className="space-y-2 pt-1">
              {results.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-4">No public profiles found matching "{query}".</p>
              ) : (
                results.map((u) => (
                  <Link
                    key={u.username}
                    to={`/u/${u.username}`}
                    className="flex items-center gap-3 p-3 bg-bg-primary border border-border hover:border-accent/50 rounded-xl transition-colors"
                  >
                    <Avatar url={u.avatar_url} name={u.display_name} username={u.username} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{u.display_name || u.username}</p>
                      <p className="text-xs text-text-muted">@{u.username}</p>
                      {u.bio && <p className="text-xs text-text-secondary truncate mt-0.5">{u.bio}</p>}
                    </div>
                    <span className="text-xs text-accent font-medium">View →</span>
                  </Link>
                ))
              )}
            </div>
          )}
        </section>

        {/* Premade Plans */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent" /> Published Premade Plans
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {premadeWorkouts.map((p) => (
              <div key={p.id} className="bg-bg-card border border-border rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs text-accent font-medium mb-1.5">
                    <Dumbbell className="w-4 h-4" /> Workout Plan
                  </div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-xs text-text-muted mt-1 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> {p.duration_days}d {p.difficulty ? `• ${p.difficulty}` : ''}
                    {p.category ? `• ${p.category}` : ''}
                  </p>
                  {p.description && <p className="text-sm text-text-secondary mt-2 line-clamp-2">{p.description}</p>}
                </div>
                <button
                  onClick={() => setPreview({ plan: p, type: 'workout' })}
                  className="mt-4 text-left text-xs font-semibold text-accent hover:text-accent-hover"
                >
                  Inspect schedule →
                </button>
              </div>
            ))}
            {premadeDiets.map((p) => (
              <div key={p.id} className="bg-bg-card border border-border rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs text-blue-400 font-medium mb-1.5">
                    <UtensilsCrossed className="w-4 h-4" /> Diet Plan
                  </div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-xs text-text-muted mt-1 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> {p.duration_days}d {p.difficulty ? `• ${p.difficulty}` : ''}
                    {p.category ? `• ${p.category}` : ''}
                  </p>
                  {p.description && <p className="text-sm text-text-secondary mt-2 line-clamp-2">{p.description}</p>}
                </div>
                <button
                  onClick={() => setPreview({ plan: p, type: 'diet' })}
                  className="mt-4 text-left text-xs font-semibold text-accent hover:text-accent-hover"
                >
                  Inspect meals →
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {preview && (
        <PlanPreviewModal
          plan={preview.plan}
          type={preview.type}
          onClose={() => setPreview(null)}
          onCopy={user ? handleCopy : undefined}
          copying={copying}
        />
      )}
    </div>
  )
}
