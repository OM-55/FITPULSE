import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import PlanPreviewModal from '../components/PlanPreviewModal'
import {
  Zap, Dumbbell, UtensilsCrossed, BarChart3, Calendar, Users, Shield,
  ArrowRight, Sparkles, CheckCircle2, Flame, Search
} from 'lucide-react'
import { APP_NAME } from '../lib/constants'
import type { WorkoutPlan, DietPlan } from '../types/database'

const features = [
  {
    icon: Dumbbell,
    title: 'Recurring Workout Schedules',
    description: 'Build 5, 6, or 7-day splits with sets, reps, target weights, rest timers, and rest days that repeat weekly.',
  },
  {
    icon: UtensilsCrossed,
    title: 'Flexible Diet Planning',
    description: 'Plan daily meals with food quantities and optional calories & macros — never forced.',
  },
  {
    icon: Calendar,
    title: 'Fresh Daily Checklists',
    description: 'Past completions stay locked in history while every new week generates a clean checklist in your timezone.',
  },
  {
    icon: BarChart3,
    title: 'True Consistency Analytics',
    description: 'Track streaks, weekly adherence, strength progression, and missed workouts without counting rest days.',
  },
  {
    icon: Users,
    title: 'Public Profiles & Sharing',
    description: 'Publish selected plans to your /u/username profile and discover routines from other athletes.',
  },
  {
    icon: Shield,
    title: 'Curated Premade Plans',
    description: 'Apply official workout and diet templates with one click — get your own editable copy instantly.',
  },
]

const steps = [
  { step: '01', title: 'Build or Pick a Plan', description: 'Create a 5, 6, or 7-day schedule or copy a premade plan.' },
  { step: '02', title: 'Check Off Daily', description: 'Log exercises, actual weights, meals, and water each day.' },
  { step: '03', title: 'Track Consistency', description: 'Review streaks, personal records, and 30-day adherence.' },
]

export default function LandingPage() {
  const { user } = useAuth()
  const [premadeWorkouts, setPremadeWorkouts] = useState<WorkoutPlan[]>([])
  const [premadeDiets, setPremadeDiets] = useState<DietPlan[]>([])
  const [preview, setPreview] = useState<{ plan: WorkoutPlan | DietPlan; type: 'workout' | 'diet' } | null>(null)

  useEffect(() => {
    async function loadPublicPlans() {
      const [{ data: wp }, { data: dp }] = await Promise.all([
        supabase
          .from('workout_plans')
          .select('*')
          .eq('is_premade', true)
          .eq('visibility', 'public')
          .order('created_at')
          .limit(3),
        supabase
          .from('diet_plans')
          .select('*')
          .eq('is_premade', true)
          .eq('visibility', 'public')
          .order('created_at')
          .limit(3),
      ])
      setPremadeWorkouts((wp as WorkoutPlan[]) || [])
      setPremadeDiets((dp as DietPlan[]) || [])
    }
    loadPublicPlans()
  }, [])

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-bg-primary/85 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-black" />
            </div>
            <span className="text-lg font-bold">{APP_NAME}</span>
          </Link>

          <div className="hidden md:flex items-center gap-7">
            <a href="#features" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              How It Works
            </a>
            <a href="#plans" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              Premade Plans
            </a>
            <Link to="/explore" className="text-sm text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1">
              <Search className="w-3.5 h-3.5" /> Explore
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <Link
                to="/dashboard"
                className="text-sm font-semibold bg-accent hover:bg-accent-hover text-black px-4 py-2 rounded-lg transition-colors"
              >
                Open Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm text-text-secondary hover:text-text-primary transition-colors px-3 py-2">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-semibold bg-accent hover:bg-accent-hover text-black px-4 py-2 rounded-lg transition-colors"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-accent-muted text-accent text-xs sm:text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <Sparkles className="w-4 h-4" />
            Recurring Workout & Diet Planner
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6">
            Plan your week once.
            <span className="text-accent block sm:inline"> Execute every day.</span>
          </h1>
          <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto mb-8 leading-relaxed">
            Build recurring 5, 6, or 7-day workout and diet schedules, follow fresh daily checklists, and track your
            real consistency without losing a single day of history.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to={user ? '/dashboard' : '/register'}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-black font-semibold px-7 py-3 rounded-xl transition-colors text-sm sm:text-base"
            >
              {user ? 'Go to Dashboard' : 'Get Started Free'} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/explore"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-border hover:border-border-light text-text-primary font-medium px-7 py-3 rounded-xl transition-colors text-sm sm:text-base"
            >
              Browse Public Plans
            </Link>
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className="max-w-5xl mx-auto mt-14">
          <div className="bg-bg-secondary border border-border rounded-2xl p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-danger/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-warning/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-accent/70" />
                <span className="text-xs text-text-muted ml-2">Dashboard Preview</span>
              </div>
              <span className="text-xs text-accent font-medium flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" /> 14-day streak
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-text-muted uppercase">Monday — Push A</p>
                <p className="text-lg font-bold mt-1">75% Complete</p>
                <div className="mt-3 space-y-2 text-xs text-text-secondary">
                  <div className="flex items-center gap-2 text-text-muted line-through">
                    <CheckCircle2 className="w-4 h-4 text-accent" /> Bench Press — 4 × 8 @ 70kg
                  </div>
                  <div className="flex items-center gap-2 text-text-muted line-through">
                    <CheckCircle2 className="w-4 h-4 text-accent" /> Incline DB Press — 3 × 10
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border border-border-light inline-block" /> Lateral Raises — 3 × 15
                  </div>
                </div>
              </div>

              <div className="bg-bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-text-muted uppercase">Today's Nutrition</p>
                <p className="text-lg font-bold mt-1">3 / 4 Meals</p>
                <div className="mt-3 space-y-2 text-xs text-text-secondary">
                  <div className="flex justify-between">
                    <span>Breakfast — Oats & Whey</span>
                    <span className="text-accent">Done</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Lunch — Rice, Dal & Paneer</span>
                    <span className="text-accent">Done</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dinner — Roti & Veggies</span>
                    <span className="text-text-muted">8:30 PM</span>
                  </div>
                </div>
              </div>

              <div className="bg-bg-card border border-border rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <p className="text-xs text-text-muted uppercase">Weekly Consistency</p>
                  <p className="text-2xl font-bold text-accent mt-1">92%</p>
                </div>
                <div className="flex items-end gap-1.5 h-16 mt-4">
                  {[85, 100, 100, 90, 100, 75, 100].map((h, i) => (
                    <div key={i} className="flex-1 bg-bg-hover rounded-t overflow-hidden h-full flex items-end">
                      <div className="w-full bg-accent rounded-t" style={{ height: `${h}%` }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 px-4 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Built for real training discipline</h2>
            <p className="text-text-secondary text-base max-w-2xl mx-auto">
              Clean schedules, persistent history, and privacy-first architecture powered by PostgreSQL Row Level Security.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const Icon = f.icon
              return (
                <div key={f.title} className="bg-bg-card border border-border rounded-xl p-6 hover:border-border-light transition-colors">
                  <div className="w-10 h-10 bg-accent-muted rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-accent" />
                  </div>
                  <h3 className="text-base font-semibold mb-2">{f.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{f.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 px-4 bg-bg-secondary border-t border-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">How {APP_NAME} works</h2>
            <p className="text-text-secondary">Three steps from blank page to measurable results.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.step} className="text-center">
                <div className="text-3xl font-bold text-accent mb-3">{s.step}</div>
                <h3 className="text-lg font-semibold mb-1.5">{s.title}</h3>
                <p className="text-text-secondary text-sm">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Public Premade Plans */}
      <section id="plans" className="py-16 px-4 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-bold">Public Premade Plans</h2>
              <p className="text-text-secondary text-sm mt-1">
                Inspect curated workout and diet schedules right now — no account needed.
              </p>
            </div>
            <Link to="/explore" className="text-sm text-accent hover:text-accent-hover font-medium flex items-center gap-1">
              Explore all plans & users <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {premadeWorkouts.length === 0 && premadeDiets.length === 0 ? (
            <div className="bg-bg-card border border-border rounded-xl p-8 text-center text-sm text-text-muted">
              Sign up to build your custom 5, 6, or 7-day workout and diet schedules.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {premadeWorkouts.map((p) => (
                <div key={p.id} className="bg-bg-card border border-border rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-accent font-medium mb-2">
                      <Dumbbell className="w-4 h-4" /> Workout • {p.duration_days}d
                    </div>
                    <h3 className="font-semibold text-base mb-1">{p.name}</h3>
                    <p className="text-xs text-text-muted mb-2">
                      {p.difficulty || 'All levels'} {p.category ? `• ${p.category}` : ''}
                    </p>
                    {p.description && <p className="text-sm text-text-secondary line-clamp-2">{p.description}</p>}
                  </div>
                  <div className="pt-4 mt-4 border-t border-border flex items-center justify-between">
                    <button
                      onClick={() => setPreview({ plan: p, type: 'workout' })}
                      className="text-xs font-medium text-accent hover:text-accent-hover"
                    >
                      Inspect schedule →
                    </button>
                    <Link to={user ? '/plans' : '/register'} className="text-xs text-text-muted hover:text-text-primary">
                      Apply
                    </Link>
                  </div>
                </div>
              ))}
              {premadeDiets.map((p) => (
                <div key={p.id} className="bg-bg-card border border-border rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-blue-400 font-medium mb-2">
                      <UtensilsCrossed className="w-4 h-4" /> Diet • {p.duration_days}d
                    </div>
                    <h3 className="font-semibold text-base mb-1">{p.name}</h3>
                    <p className="text-xs text-text-muted mb-2">
                      {p.difficulty || 'All levels'} {p.category ? `• ${p.category}` : ''}
                    </p>
                    {p.description && <p className="text-sm text-text-secondary line-clamp-2">{p.description}</p>}
                  </div>
                  <div className="pt-4 mt-4 border-t border-border flex items-center justify-between">
                    <button
                      onClick={() => setPreview({ plan: p, type: 'diet' })}
                      className="text-xs font-medium text-accent hover:text-accent-hover"
                    >
                      Inspect meals →
                    </button>
                    <Link to={user ? '/plans' : '/register'} className="text-xs text-text-muted hover:text-text-primary">
                      Apply
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 border-t border-border bg-bg-secondary">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-accent rounded flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-black" />
            </div>
            <span className="text-sm font-semibold">{APP_NAME}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-text-muted">
            <a href="#features" className="hover:text-text-secondary">Features</a>
            <a href="#how-it-works" className="hover:text-text-secondary">How It Works</a>
            <Link to="/explore" className="hover:text-text-secondary">Explore</Link>
            <Link to="/login" className="hover:text-text-secondary">Login</Link>
          </div>
          <p className="text-xs text-text-muted">&copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
        </div>
      </footer>

      {preview && (
        <PlanPreviewModal plan={preview.plan} type={preview.type} onClose={() => setPreview(null)} />
      )}
    </div>
  )
}
