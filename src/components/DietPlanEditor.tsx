import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { WEEKDAYS, PLAN_DURATIONS, DIFFICULTY_LEVELS, DIET_CATEGORIES } from '../lib/constants'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Check, ChevronDown, ChevronUp, Loader2, ArrowLeft, Eye, EyeOff
} from 'lucide-react'

export interface FoodItemForm {
  food_name: string
  quantity: string
  calories: number | null
  protein: number | null
  carbohydrates: number | null
  fats: number | null
}

export interface MealForm {
  id?: string
  meal_name: string
  scheduled_time: string
  notes: string
  items: FoodItemForm[]
}

export interface DietDayForm {
  id?: string
  weekday: number
  title: string
  meals: MealForm[]
}

export interface DietPlanFormData {
  id?: string
  name: string
  description: string
  duration_days: number
  difficulty: string
  category: string
  visibility: 'private' | 'public'
  is_premade?: boolean
  days: DietDayForm[]
}

export function buildEmptyDietDays(duration: number): DietDayForm[] {
  return WEEKDAYS.slice(0, duration).map((name, i) => ({
    weekday: i,
    title: name,
    meals: [],
  }))
}

interface DietPlanEditorProps {
  initialData: DietPlanFormData
  isPremadeMode?: boolean
  onCancel: () => void
  onSaved: (planId: string) => void | Promise<void>
}

export default function DietPlanEditor({
  initialData,
  isPremadeMode = false,
  onCancel,
  onSaved,
}: DietPlanEditorProps) {
  const [name, setName] = useState(initialData.name)
  const [description, setDescription] = useState(initialData.description)
  const [duration, setDuration] = useState(initialData.duration_days)
  const [difficulty, setDifficulty] = useState(initialData.difficulty || 'Beginner')
  const [category, setCategory] = useState(initialData.category || '')
  const [visibility, setVisibility] = useState<'private' | 'public'>(initialData.visibility || 'private')
  const [days, setDays] = useState<DietDayForm[]>(
    initialData.days.length > 0 ? initialData.days : buildEmptyDietDays(initialData.duration_days || 7)
  )
  const [activeDay, setActiveDay] = useState(0)
  const [saving, setSaving] = useState(false)

  function handleDurationChange(newDur: number) {
    setDuration(newDur)
    setDays((prev) => {
      const next: DietDayForm[] = []
      for (let i = 0; i < newDur; i++) {
        const existing = prev.find((d) => d.weekday === i)
        next.push(existing || { weekday: i, title: WEEKDAYS[i], meals: [] })
      }
      return next
    })
    if (activeDay >= newDur) setActiveDay(0)
  }

  function updateDay(patch: Partial<DietDayForm>) {
    setDays((prev) => prev.map((d, idx) => (idx === activeDay ? { ...d, ...patch } : d)))
  }

  function addMeal() {
    const cur = days[activeDay]
    if (!cur) return
    updateDay({
      meals: [
        ...cur.meals,
        { meal_name: '', scheduled_time: '', notes: '', items: [{ food_name: '', quantity: '', calories: null, protein: null, carbohydrates: null, fats: null }] },
      ],
    })
  }

  function updateMeal(mi: number, patch: Partial<MealForm>) {
    const cur = days[activeDay]
    if (!cur) return
    updateDay({ meals: cur.meals.map((m, idx) => (idx === mi ? { ...m, ...patch } : m)) })
  }

  function removeMeal(mi: number) {
    const cur = days[activeDay]
    if (!cur) return
    updateDay({ meals: cur.meals.filter((_, idx) => idx !== mi) })
  }

  function moveMeal(mi: number, dir: -1 | 1) {
    const cur = days[activeDay]
    if (!cur) return
    const target = mi + dir
    if (target < 0 || target >= cur.meals.length) return
    const meals = [...cur.meals]
    ;[meals[mi], meals[target]] = [meals[target], meals[mi]]
    updateDay({ meals })
  }

  function addItem(mi: number) {
    const cur = days[activeDay]
    if (!cur) return
    const meal = cur.meals[mi]
    updateMeal(mi, {
      items: [...meal.items, { food_name: '', quantity: '', calories: null, protein: null, carbohydrates: null, fats: null }],
    })
  }

  function updateItem(mi: number, ii: number, field: keyof FoodItemForm, val: unknown) {
    const cur = days[activeDay]
    if (!cur) return
    const meal = cur.meals[mi]
    updateMeal(mi, {
      items: meal.items.map((it, idx) => (idx === ii ? { ...it, [field]: val } : it)),
    })
  }

  function removeItem(mi: number, ii: number) {
    const cur = days[activeDay]
    if (!cur) return
    const meal = cur.meals[mi]
    updateMeal(mi, { items: meal.items.filter((_, idx) => idx !== ii) })
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
        visibility,
        is_premade: isPremadeMode || Boolean(initialData.is_premade),
        days: days.map((d) => ({
          weekday: d.weekday,
          title: d.title.trim() || WEEKDAYS[d.weekday],
          meals: d.meals
            .filter((m) => m.meal_name.trim())
            .map((m) => ({
              id: m.id || null,
              meal_name: m.meal_name.trim(),
              scheduled_time: m.scheduled_time.trim() || null,
              notes: m.notes.trim() || null,
              items: m.items
                .filter((it) => it.food_name.trim())
                .map((it) => ({
                  food_name: it.food_name.trim(),
                  quantity: it.quantity.trim() || null,
                  calories: it.calories != null && !Number.isNaN(it.calories) ? it.calories : null,
                  protein: it.protein != null && !Number.isNaN(it.protein) ? it.protein : null,
                  carbohydrates: it.carbohydrates != null && !Number.isNaN(it.carbohydrates) ? it.carbohydrates : null,
                  fats: it.fats != null && !Number.isNaN(it.fats) ? it.fats : null,
                })),
            })),
        })),
      }

      const { data: savedId, error } = await supabase.rpc('save_diet_plan', { p_plan: payload })
      if (error) throw error
      toast.success(initialData.id ? 'Diet plan updated!' : 'Diet plan created!')
      await onSaved(savedId as string)
    } catch (err: any) {
      toast.error(err.message || 'Failed to save diet plan')
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
              ? 'Edit Premade Diet Plan'
              : 'Edit Diet Plan'
            : isPremadeMode
              ? 'Create Premade Diet Plan'
              : 'Create Diet Plan'}
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Calories and macros are completely optional. Past meal records are always preserved.
        </p>
      </div>

      {/* Metadata */}
      <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Plan Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
              placeholder="e.g. High Protein Lean Bulk"
              maxLength={100}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Category</label>
            <input
              list="diet-categories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
              placeholder="e.g. High Protein, Vegetarian"
              maxLength={50}
            />
            <datalist id="diet-categories">
              {DIET_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
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

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent resize-none h-20"
            placeholder="Describe dietary approach, daily targets, or prep tips..."
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
              {visibility === 'public' ? 'Public' : 'Private'}
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
            {day.meals.length > 0 ? ` (${day.meals.length})` : ''}
          </button>
        ))}
      </div>

      {/* Active Day Meals */}
      {currentDay && (
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <input
            value={currentDay.title}
            onChange={(e) => updateDay({ title: e.target.value })}
            className="bg-transparent text-lg font-semibold focus:outline-none border-b border-border focus:border-accent pb-1 mb-4 w-full max-w-md block"
            placeholder={`${WEEKDAYS[currentDay.weekday]} label`}
          />

          <div className="space-y-4 mb-4">
            {currentDay.meals.map((meal, mi) => (
              <div key={mi} className="bg-bg-primary border border-border rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moveMeal(mi, -1)}
                      disabled={mi === 0}
                      className="text-text-muted hover:text-text-primary disabled:opacity-30"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveMeal(mi, 1)}
                      disabled={mi === currentDay.meals.length - 1}
                      className="text-text-muted hover:text-text-primary disabled:opacity-30"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  <input
                    value={meal.meal_name}
                    onChange={(e) => updateMeal(mi, { meal_name: e.target.value })}
                    className="flex-1 min-w-[160px] bg-bg-card border border-border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-accent"
                    placeholder="Meal name (e.g. Breakfast, Pre-workout)"
                  />

                  <input
                    type="time"
                    value={meal.scheduled_time ? meal.scheduled_time.slice(0, 5) : ''}
                    onChange={(e) => updateMeal(mi, { scheduled_time: e.target.value })}
                    className="bg-bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                  />

                  <button
                    type="button"
                    onClick={() => removeMeal(mi)}
                    className="text-text-muted hover:text-danger p-1.5"
                    title="Delete meal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Food Items */}
                <div className="space-y-2 pl-2 border-l-2 border-border">
                  {meal.items.map((it, ii) => (
                    <div key={ii} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        value={it.food_name}
                        onChange={(e) => updateItem(mi, ii, 'food_name', e.target.value)}
                        className="col-span-6 sm:col-span-3 bg-bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent"
                        placeholder="Food item (e.g. Oats)"
                      />
                      <input
                        value={it.quantity}
                        onChange={(e) => updateItem(mi, ii, 'quantity', e.target.value)}
                        className="col-span-6 sm:col-span-2 bg-bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent"
                        placeholder="Qty (70g)"
                      />
                      <input
                        type="number"
                        min={0}
                        value={it.calories ?? ''}
                        onChange={(e) =>
                          updateItem(mi, ii, 'calories', e.target.value === '' ? null : parseFloat(e.target.value))
                        }
                        className="col-span-3 sm:col-span-2 bg-bg-card border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-accent"
                        placeholder="kcal"
                      />
                      <input
                        type="number"
                        min={0}
                        value={it.protein ?? ''}
                        onChange={(e) =>
                          updateItem(mi, ii, 'protein', e.target.value === '' ? null : parseFloat(e.target.value))
                        }
                        className="col-span-3 sm:col-span-1 bg-bg-card border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-accent"
                        placeholder="P(g)"
                      />
                      <input
                        type="number"
                        min={0}
                        value={it.carbohydrates ?? ''}
                        onChange={(e) =>
                          updateItem(mi, ii, 'carbohydrates', e.target.value === '' ? null : parseFloat(e.target.value))
                        }
                        className="col-span-2 sm:col-span-1 bg-bg-card border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-accent"
                        placeholder="C(g)"
                      />
                      <input
                        type="number"
                        min={0}
                        value={it.fats ?? ''}
                        onChange={(e) =>
                          updateItem(mi, ii, 'fats', e.target.value === '' ? null : parseFloat(e.target.value))
                        }
                        className="col-span-2 sm:col-span-2 bg-bg-card border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-accent"
                        placeholder="F(g)"
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(mi, ii)}
                        className="col-span-2 sm:col-span-1 text-text-muted hover:text-danger flex justify-center"
                        title="Remove food item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addItem(mi)}
                    className="text-xs text-accent hover:text-accent-hover font-medium flex items-center gap-1 pt-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add food item
                  </button>
                </div>

                <input
                  value={meal.notes}
                  onChange={(e) => updateMeal(mi, { notes: e.target.value })}
                  className="w-full bg-bg-card border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-accent"
                  placeholder="Meal notes (optional)"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addMeal}
            className="w-full border border-dashed border-border hover:border-accent text-text-secondary hover:text-accent py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Meal to {WEEKDAYS[currentDay.weekday]}
          </button>
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
