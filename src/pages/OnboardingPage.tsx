import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { APP_NAME, COMMON_TIMEZONES } from '../lib/constants'
import toast from 'react-hot-toast'
import { Zap, Check, ArrowRight, Loader2, Dumbbell, UtensilsCrossed } from 'lucide-react'
import type { WorkoutPlan, DietPlan } from '../types/database'

export default function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [saving, setSaving] = useState(false)

  // Step 1
  const [displayName, setDisplayName] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric')

  // Step 2
  const [premadeWorkouts, setPremadeWorkouts] = useState<WorkoutPlan[]>([])
  const [premadeDiets, setPremadeDiets] = useState<DietPlan[]>([])
  const [selectedWorkout, setSelectedWorkout] = useState<string>('')
  const [selectedDiet, setSelectedDiet] = useState<string>('')

  // Step 3
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [notifyWorkout, setNotifyWorkout] = useState(true)
  const [notifyMeals, setNotifyMeals] = useState(true)
  const [notifyWater, setNotifyWater] = useState(false)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || profile.username)
      setTimezone(profile.timezone || 'UTC')
      setUnits(profile.preferred_units || 'metric')
      setVisibility(profile.profile_visibility || 'public')
      if (profile.onboarding_completed) {
        navigate('/dashboard', { replace: true })
      }
    }
  }, [profile, navigate])

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

  async function finishOnboarding() {
    if (!user) return
    setSaving(true)
    try {
      const { error: profErr } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || profile?.username || 'User',
          timezone,
          preferred_units: units,
          profile_visibility: visibility,
          notify_workout: notifyWorkout,
          notify_meals: notifyMeals,
          notify_water: notifyWater,
          onboarding_completed: true,
        })
        .eq('id', user.id)
      if (profErr) throw profErr

      if (selectedWorkout) {
        const { error } = await supabase.rpc('copy_workout_plan', {
          p_source: selectedWorkout,
          p_activate: true,
        })
        if (error) throw error
      }
      if (selectedDiet) {
        const { error } = await supabase.rpc('copy_diet_plan', {
          p_source: selectedDiet,
          p_activate: true,
        })
        if (error) throw error
      }

      await supabase.rpc('ensure_today')
      await refreshProfile()
      toast.success(`Welcome to ${APP_NAME}!`)
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      toast.error(err.message || 'Could not complete onboarding')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="text-center mb-6">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center mx-auto mb-3">
            <Zap className="w-6 h-6 text-black" />
          </div>
          <h1 className="text-2xl font-bold">Welcome to {APP_NAME}</h1>
          <p className="text-sm text-text-secondary mt-1">Step {step} of 3 — Set up your workspace in under a minute</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 w-16 rounded-full transition-colors ${s <= step ? 'bg-accent' : 'bg-bg-hover'}`}
              />
            ))}
          </div>
        </div>

        <div className="bg-bg-card border border-border rounded-2xl p-6 space-y-5">
          {step === 1 && (
            <>
              <h2 className="text-lg font-semibold">Your Profile & Preferences</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Display Name</label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Timezone (used for daily checklists)</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
                  >
                    {COMMON_TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Preferred Units</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['metric', 'imperial'] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUnits(u)}
                        className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                          units === u
                            ? 'bg-accent text-black border-accent'
                            : 'bg-bg-primary border-border text-text-secondary'
                        }`}
                      >
                        {u === 'metric' ? 'Metric (kg)' : 'Imperial (lb)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setStep(2)}
                  className="bg-accent hover:bg-accent-hover text-black font-semibold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h2 className="text-lg font-semibold">Pick Starter Plans (Optional)</h2>
                <p className="text-xs text-text-muted mt-1">
                  Applying a premade plan creates your own editable copy and sets it active. You can skip and build from scratch.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-text-secondary mb-2 flex items-center gap-1.5">
                    <Dumbbell className="w-4 h-4 text-accent" /> Workout Plan
                  </p>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setSelectedWorkout('')}
                      className={`w-full text-left p-3 rounded-xl border text-sm transition-colors ${
                        selectedWorkout === ''
                          ? 'border-accent bg-accent-muted/40'
                          : 'border-border bg-bg-primary hover:border-border-light'
                      }`}
                    >
                      Skip for now — I'll create my own
                    </button>
                    {premadeWorkouts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedWorkout(p.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors ${
                          selectedWorkout === p.id
                            ? 'border-accent bg-accent-muted/40'
                            : 'border-border bg-bg-primary hover:border-border-light'
                        }`}
                      >
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {p.duration_days} days • {p.difficulty || 'All levels'} {p.category ? `• ${p.category}` : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-text-secondary mb-2 flex items-center gap-1.5">
                    <UtensilsCrossed className="w-4 h-4 text-blue-400" /> Diet Plan
                  </p>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDiet('')}
                      className={`w-full text-left p-3 rounded-xl border text-sm transition-colors ${
                        selectedDiet === ''
                          ? 'border-accent bg-accent-muted/40'
                          : 'border-border bg-bg-primary hover:border-border-light'
                      }`}
                    >
                      Skip for now — I'll create my own
                    </button>
                    {premadeDiets.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedDiet(p.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors ${
                          selectedDiet === p.id
                            ? 'border-accent bg-accent-muted/40'
                            : 'border-border bg-bg-primary hover:border-border-light'
                        }`}
                      >
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {p.duration_days} days • {p.difficulty || 'All levels'} {p.category ? `• ${p.category}` : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button onClick={() => setStep(1)} className="text-sm text-text-muted hover:text-text-secondary px-4 py-2">
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="bg-accent hover:bg-accent-hover text-black font-semibold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-lg font-semibold">Privacy & In-App Reminders</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Profile Visibility</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['public', 'private'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVisibility(v)}
                        className={`py-2.5 rounded-lg text-sm font-medium capitalize border transition-colors ${
                          visibility === v
                            ? 'bg-accent text-black border-accent'
                            : 'bg-bg-primary border-border text-text-secondary'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-text-muted mt-1.5">
                    Daily checklists and private plans are always strictly private regardless of profile visibility.
                  </p>
                </div>

                <div className="space-y-2.5 pt-2">
                  <p className="text-sm text-text-secondary">Optional In-App Reminders</p>
                  {[
                    { label: "Remind me about today's workout", value: notifyWorkout, set: setNotifyWorkout },
                    { label: 'Remind me about planned meals', value: notifyMeals, set: setNotifyMeals },
                    { label: 'Daily water intake reminder', value: notifyWater, set: setNotifyWater },
                  ].map((item) => (
                    <label
                      key={item.label}
                      className="flex items-center justify-between p-3 bg-bg-primary border border-border rounded-lg cursor-pointer"
                    >
                      <span className="text-sm">{item.label}</span>
                      <input
                        type="checkbox"
                        checked={item.value}
                        onChange={(e) => item.set(e.target.checked)}
                        className="accent-[#84cc16] w-4 h-4"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button onClick={() => setStep(2)} className="text-sm text-text-muted hover:text-text-secondary px-4 py-2">
                  Back
                </button>
                <button
                  onClick={finishOnboarding}
                  disabled={saving}
                  className="bg-accent hover:bg-accent-hover text-black font-semibold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Finish Setup
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
