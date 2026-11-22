import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Avatar from '../components/Avatar'
import PlanPreviewModal from '../components/PlanPreviewModal'
import toast from 'react-hot-toast'
import { User, Dumbbell, UtensilsCrossed, ArrowLeft, Loader2, Calendar, Award } from 'lucide-react'
import type { PublicProfileData, WorkoutPlan, DietPlan } from '../types/database'

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PublicProfileData | null>(null)
  const [preview, setPreview] = useState<{ plan: WorkoutPlan | DietPlan; type: 'workout' | 'diet' } | null>(null)
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      if (!username) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const { data: payload, error } = await supabase.rpc('get_public_profile', {
          p_username: username.toLowerCase(),
        })
        if (!active) return
        if (error || !payload) {
          setData(null)
        } else {
          setData(payload as PublicProfileData)
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [username])

  async function handleCopy(activate: boolean) {
    if (!preview || !user) return
    setCopying(true)
    try {
      const fn = preview.type === 'workout' ? 'copy_workout_plan' : 'copy_diet_plan'
      const { error } = await supabase.rpc(fn, { p_source: preview.plan.id, p_activate: activate })
      if (error) throw error
      toast.success(activate ? 'Plan copied & activated!' : 'Editable copy saved to your plans!')
      setPreview(null)
    } catch (err: any) {
      toast.error(err.message || 'Could not copy plan')
    } finally {
      setCopying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <User className="w-14 h-14 text-text-muted mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Profile unavailable</h1>
          <p className="text-text-muted text-sm mb-5">
            This user does not exist or their profile is set to private.
          </p>
          <div className="flex justify-center gap-4 text-sm">
            <Link to="/explore" className="text-accent hover:text-accent-hover font-medium">
              Search users
            </Link>
            <Link to="/" className="text-text-secondary hover:text-text-primary">
              Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <Link to={user ? '/explore' : '/'} className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          {!user && (
            <Link to="/register" className="text-xs font-semibold bg-accent text-black px-3.5 py-1.5 rounded-lg">
              Join FitPulse
            </Link>
          )}
        </div>

        {/* Profile Card */}
        <div className="bg-bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <Avatar url={data.avatar_url} name={data.display_name} username={data.username} size="lg" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{data.display_name || data.username}</h1>
              <p className="text-text-muted text-sm">@{data.username}</p>
              {data.bio && <p className="text-text-secondary text-sm mt-2">{data.bio}</p>}
            </div>
          </div>

          {data.stats && (
            <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-border">
              <div className="bg-bg-primary border border-border rounded-xl p-3 flex items-center gap-3">
                <Award className="w-5 h-5 text-accent" />
                <div>
                  <p className="text-lg font-bold">{data.stats.workout_days_completed}</p>
                  <p className="text-xs text-text-muted">Workout days completed</p>
                </div>
              </div>
              <div className="bg-bg-primary border border-border rounded-xl p-3 flex items-center gap-3">
                <UtensilsCrossed className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-lg font-bold">{data.stats.meals_completed}</p>
                  <p className="text-xs text-text-muted">Meals logged</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Public Plans */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Public Plans</h2>
          {data.workout_plans.length === 0 && data.diet_plans.length === 0 ? (
            <div className="text-center py-10 bg-bg-card border border-border rounded-xl">
              <p className="text-text-muted text-sm">No publicly shared plans yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.workout_plans.map((p) => (
                <div
                  key={p.id}
                  className="bg-bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <Dumbbell className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <h3 className="font-medium truncate">{p.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {p.duration_days} days
                        </span>
                        {p.difficulty && <span>• {p.difficulty}</span>}
                        {p.category && <span>• {p.category}</span>}
                      </div>
                      {p.description && <p className="text-text-secondary text-xs mt-1 line-clamp-2">{p.description}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => setPreview({ plan: p as WorkoutPlan, type: 'workout' })}
                    className="text-xs font-semibold text-accent hover:text-accent-hover whitespace-nowrap"
                  >
                    Inspect →
                  </button>
                </div>
              ))}

              {data.diet_plans.map((p) => (
                <div
                  key={p.id}
                  className="bg-bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <UtensilsCrossed className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <h3 className="font-medium truncate">{p.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {p.duration_days} days
                        </span>
                        {p.difficulty && <span>• {p.difficulty}</span>}
                        {p.category && <span>• {p.category}</span>}
                      </div>
                      {p.description && <p className="text-text-secondary text-xs mt-1 line-clamp-2">{p.description}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => setPreview({ plan: p as DietPlan, type: 'diet' })}
                    className="text-xs font-semibold text-accent hover:text-accent-hover whitespace-nowrap"
                  >
                    Inspect →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
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
