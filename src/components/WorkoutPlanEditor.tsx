import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { WEEKDAYS, PLAN_DURATIONS, DIFFICULTY_LEVELS, WORKOUT_CATEGORIES } from '../lib/constants'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Check, ChevronDown, ChevronUp, Copy, Loader2, ArrowLeft, Eye, EyeOff
} from 'lucide-react'

export interface ExerciseForm {
  id?: string
  exercise_name: string
  sets: number
  reps: number
  target_weight: number | null
  rest_seconds: number | null
  instructions: string
  notes: string
}

export interface WorkoutDayForm {
  id?: string
  weekday: number
  title: string
  is_rest_day: boolean
  exercises: ExerciseForm[]
}

export interface WorkoutPlanFormData {
  id?: string
  name: string
  description: string
  duration_days: number
  difficulty: string
  category: string
  equipment: string
  visibility: 'private' | 'public'
  is_premade?: boolean
  days: WorkoutDayForm[]
}

export function buildEmptyWorkoutDays(duration: number): WorkoutDayForm[] {
  return WEEKDAYS.slice(0, duration).map((name, i) => ({
    weekday: i,
    title: name,
    is_rest_day: false,
    exercises: [],
  }))
}

interface WorkoutPlanEditorProps {
  initialData: WorkoutPlanFormData
  unitLabel?: 'kg' | 'lb'
  isPremadeMode?: boolean
  onCancel: () => void
  onSaved: (planId: string) => void | Promise<void>
}

export default function WorkoutPlanEditor({
  initialData,
  unitLabel = 'kg',
  isPremadeMode = false,
  onCancel,
  onSaved,
}: WorkoutPlanEditorProps) {
  const [name, setName] = useState(initialData.name)
  const [description, setDescription] = useState(initialData.description)
  const [duration, setDuration] = useState(initialData.duration_days)
  const [difficulty, setDifficulty] = useState(initialData.difficulty || 'Intermediate')
  const [category, setCategory] = useState(initialData.category || '')
  const [equipment, setEquipment] = useState(initialData.equipment || '')
  const [visibility, setVisibility] = useState<'private' | 'public'>(initialData.visibility || 'private')
  const [days, setDays] = useState<WorkoutDayForm[]>(
    initialData.days.length > 0 ? initialData.days : buildEmptyWorkoutDays(initialData.duration_days || 7)
  )
  const [activeDay, setActiveDay] = useState(0)
  const [saving, setSaving] = useState(false)

  function handleDurationChange(newDur: number) {
    setDuration(newDur)
    setDays((prev) => {
      const next: WorkoutDayForm[] = []
      for (let i = 0; i < newDur; i++) {
        const existing = prev.find((d) => d.weekday === i)
        next.push(existing || { weekday: i, title: WEEKDAYS[i], is_rest_day: false, exercises: [] })
      }
      return next
    })
    if (activeDay >= newDur) setActiveDay(0)
  }

  function updateDay(patch: Partial<WorkoutDayForm>) {
    setDays((prev) => prev.map((d, idx) => (idx === activeDay ? { ...d, ...patch } : d)))
  }

  function toggleRestDay() {
    const cur = days[activeDay]
    if (!cur) return
    const nextRest = !cur.is_rest_day
    updateDay({
      is_rest_day: nextRest,
      title: nextRest ? 'Rest Day' : WEEKDAYS[cur.weekday],
    })
  }

  function addExercise() {
    const cur = days[activeDay]
    if (!cur) return
    updateDay({
      exercises: [
        ...cur.exercises,
        {
          exercise_name: '',
          sets: 3,
          reps: 10,
          target_weight: null,
          rest_seconds: 60,
          instructions: '',
          notes: '',
        },
      ],
    })
  }

  function updateExercise(idx: number, field: keyof ExerciseForm, value: unknown) {
    const cur = days[activeDay]
    if (!cur) return
    const exercises = cur.exercises.map((ex, i) => (i === idx ? { ...ex, [field]: value } : ex))
    updateDay({ exercises })
  }

  function removeExercise(idx: number) {
    const cur = days[activeDay]
    if (!cur) return
    updateDay({ exercises: cur.exercises.filter((_, i) => i !== idx) })
  }

  function duplicateExercise(idx: number) {
    const cur = days[activeDay]
    if (!cur) return
    const copy = { ...cur.exercises[idx], id: undefined }
    const exercises = [...cur.exercises]
    exercises.splice(idx + 1, 0, copy)
    updateDay({ exercises })
  }

  function moveExercise(idx: number, dir: -1 | 1) {
    const cur = days[activeDay]
    if (!cur) return
    const target = idx + dir
    if (target < 0 || target >= cur.exercises.length) return
    const exercises = [...cur.exercises]
    ;[exercises[idx], exercises[target]] = [exercises[target], exercises[idx]]
    updateDay({ exercises })
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error('Plan name is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        id: initialData.id || null,
        name: name.trim(),
        description: description.trim() || null,
        duration_days: duration,
        difficulty: difficulty || null,
        category: category.trim() || null,
        equipment: equipment.trim() || null,
        visibility,
        is_premade: isPremadeMode || Boolean(initialData.is_premade),
        days: days.map((d) => ({
          weekday: d.weekday,
          title: d.title.trim() || WEEKDAYS[d.weekday],
          is_rest_day: d.is_rest_day,
          exercises: d.is_rest_day
            ? []
            : d.exercises
                .filter((e) => e.exercise_name.trim())
                .map((e) => ({
                  id: e.id || null,
                  exercise_name: e.exercise_name.trim(),
                  sets: Math.max(1, Number(e.sets) || 3),
                  reps: Math.max(1, Number(e.reps) || 10),
                  target_weight: e.target_weight != null && !Number.isNaN(e.target_weight) ? e.target_weight : null,
                  rest_seconds: e.rest_seconds != null && !Number.isNaN(e.rest_seconds) ? e.rest_seconds : null,
                  instructions: e.instructions.trim() || null,
                  notes: e.notes.trim() || null,
                })),
        })),
      }

      const { data: savedId, error } = await supabase.rpc('save_workout_plan', { p_plan: payload })
      if (error) throw error
      toast.success(initialData.id ? 'Workout plan updated!' : 'Workout plan created!')
      await onSaved(savedId as string)
    } catch (err: any) {
      toast.error(err.message || 'Failed to save workout plan')
    } finally {
      setSaving(false)
    }
  }

  const currentDay = days[activeDay]

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold">
          {initialData.id
            ? isPremadeMode
              ? 'Edit Premade Workout Plan'
              : 'Edit Workout Plan'
            : isPremadeMode
              ? 'Create Premade Workout Plan'
              : 'Create Workout Plan'}
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Edits preserve your past workout history automatically.
        </p>
      </div>

      {/* Plan Metadata */}
      <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Plan Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
              placeholder="e.g. Push Pull Legs"
              maxLength={100}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
            >
              {DIFFICULTY_LEVELS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Category</label>
            <input
              list="workout-categories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
              placeholder="e.g. Hypertrophy, Strength"
              maxLength={50}
            />
            <datalist id="workout-categories">
              {WORKOUT_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Equipment</label>
            <input
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
              placeholder="e.g. Full Gym, Dumbbells Only"
              maxLength={200}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent resize-none h-20"
            placeholder="Describe goals, split structure, or tips..."
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Recurring Duration</label>
            <div className="flex gap-2">
              {PLAN_DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDurationChange(d)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    duration === d
                      ? 'bg-accent text-black'
                      : 'bg-bg-hover text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Visibility</label>
            <button
              type="button"
              onClick={() => setVisibility((v) => (v === 'public' ? 'private' : 'public'))}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border transition-colors ${
                visibility === 'public'
                  ? 'border-accent/40 bg-accent-muted text-accent'
                  : 'border-border bg-bg-hover text-text-secondary'
              }`}
            >
              {visibility === 'public' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {visibility === 'public' ? 'Public (Visible on profile / library)' : 'Private (Only you)'}
            </button>
          </div>
        </div>
      </div>

      {/* Day Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {days.map((day, i) => (
          <button
            key={day.weekday}
            type="button"
            onClick={() => setActiveDay(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeDay === i
                ? 'bg-accent text-black'
                : 'bg-bg-card border border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            {WEEKDAYS[day.weekday].slice(0, 3)}
            {day.is_rest_day ? ' (Rest)' : day.exercises.length > 0 ? ` (${day.exercises.length})` : ''}
          </button>
        ))}
      </div>

      {/* Active Day Builder */}
      {currentDay && (
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <input
              value={currentDay.title}
              onChange={(e) => updateDay({ title: e.target.value })}
              className="bg-transparent text-lg font-semibold focus:outline-none border-b border-border focus:border-accent pb-1 flex-1 min-w-[200px]"
              placeholder={`${WEEKDAYS[currentDay.weekday]} focus (e.g. Chest + Triceps)`}
            />
            <button
              type="button"
              onClick={toggleRestDay}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                currentDay.is_rest_day
                  ? 'bg-accent-muted text-accent font-medium'
                  : 'bg-bg-hover text-text-muted hover:text-text-secondary'
              }`}
            >
              {currentDay.is_rest_day ? '✓ Rest Day' : 'Mark as Rest Day'}
            </button>
          </div>

          {currentDay.is_rest_day ? (
            <div className="text-center py-10">
              <p className="text-sm text-text-muted">
                Rest day — no exercises scheduled. Rest days will not break your streak.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {currentDay.exercises.map((ex, i) => (
                  <div key={i} className="bg-bg-primary border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col gap-0.5 mt-1">
                        <button
                          type="button"
                          onClick={() => moveExercise(i, -1)}
                          disabled={i === 0}
                          className="text-text-muted hover:text-text-primary disabled:opacity-30"
                          title="Move up"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveExercise(i, 1)}
                          disabled={i === currentDay.exercises.length - 1}
                          className="text-text-muted hover:text-text-primary disabled:opacity-30"
                          title="Move down"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex-1 space-y-3">
                        <input
                          value={ex.exercise_name}
                          onChange={(e) => updateExercise(i, 'exercise_name', e.target.value)}
                          className="w-full bg-bg-card border border-border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-accent"
                          placeholder="Exercise name (e.g. Barbell Bench Press)"
                        />

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="text-xs text-text-muted">Sets</label>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={ex.sets}
                              onChange={(e) => updateExercise(i, 'sets', parseInt(e.target.value, 10) || 1)}
                              className="w-full bg-bg-card border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-text-muted">Reps</label>
                            <input
                              type="number"
                              min={1}
                              max={1000}
                              value={ex.reps}
                              onChange={(e) => updateExercise(i, 'reps', parseInt(e.target.value, 10) || 1)}
                              className="w-full bg-bg-card border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-text-muted">Target ({unitLabel})</label>
                            <input
                              type="number"
                              step="0.5"
                              min={0}
                              value={ex.target_weight ?? ''}
                              onChange={(e) =>
                                updateExercise(i, 'target_weight', e.target.value === '' ? null : parseFloat(e.target.value))
                              }
                              className="w-full bg-bg-card border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
                              placeholder="Optional"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-text-muted">Rest (sec)</label>
                            <input
                              type="number"
                              min={0}
                              value={ex.rest_seconds ?? ''}
                              onChange={(e) =>
                                updateExercise(i, 'rest_seconds', e.target.value === '' ? null : parseInt(e.target.value, 10))
                              }
                              className="w-full bg-bg-card border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
                              placeholder="60"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            value={ex.instructions}
                            onChange={(e) => updateExercise(i, 'instructions', e.target.value)}
                            className="bg-bg-card border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-accent"
                            placeholder="Instructions (optional)"
                          />
                          <input
                            value={ex.notes}
                            onChange={(e) => updateExercise(i, 'notes', e.target.value)}
                            className="bg-bg-card border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-accent"
                            placeholder="Personal notes (optional)"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => duplicateExercise(i)}
                          className="text-text-muted hover:text-accent p-1"
                          title="Duplicate exercise"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeExercise(i)}
                          className="text-text-muted hover:text-danger p-1"
                          title="Remove exercise"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addExercise}
                className="w-full border border-dashed border-border hover:border-accent text-text-secondary hover:text-accent py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Exercise to {WEEKDAYS[currentDay.weekday]}
              </button>
            </>
          )}
        </div>
      )}

      {/* Save Bar */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary border border-border"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-accent hover:bg-accent-hover text-black font-semibold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {initialData.id ? 'Save Changes' : 'Create Plan'}
        </button>
      </div>
    </div>
  )
}
