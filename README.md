# FitPulse — Fitness Planner & Tracker

Production-ready, dark-first fitness planning & daily tracking web app (PWA) powered by **React + TypeScript + Tailwind CSS + Supabase**.

## Features

- **Recurring Weekly Schedules (5, 6, or 7 days)** for both Workouts and Diets.
- **Immutable Daily History**: Daily checklists are generated per calendar date in the user's selected timezone (`ensure_today()`). Completed days remain locked in history while every new week starts fresh. Editing or switching plans never destroys historical records.
- **Workout Tracker**: Sets, reps, target weight, rest seconds, instructions, notes, rest-day designation, reordering, duplication, actuals logging, and automatic Personal Records (PR) detection.
- **Diet & Water Tracker**: Meals with scheduled times, food items & quantities, optional calories/macros (never forced), meal notes, and daily water intake logging.
- **Plan Library & Admin Dashboard**: Browse published premade plans, inspect full schedules, and apply them as editable personal copies (`copy_workout_plan` / `copy_diet_plan`). Administrators author, edit, publish, and unpublish premade plans.
- **Public Profiles & Username Search**: Shareable `/u/:username` profiles showing only explicitly published plans. Private profiles and non-existent usernames return identical `null` responses (no enumeration).
- **Analytics & Streaks**: Weekly/monthly completion, missed vs. rest days (never counting future dates or rest days as missed), exercise weight/rep progression charts, optional calorie/protein charts, and 30-day overview.
- **Installable PWA**: Web app manifest, icons, and service worker configured with `NetworkOnly` for Supabase endpoints so private data is never cached on shared devices.

## Streak Logic

- Each scheduled training day with at least one completed exercise increments the streak by 1 day.
- Designated rest days (and unscheduled days in 5/6-day plans) preserve the streak without breaking it or adding to the count.
- Future dates are never counted as missed.

## Security Model

- PostgreSQL Row Level Security (RLS) enabled on all 13 tables.
- Column-level `GRANT` restrictions + trigger guards prevent users from modifying their own `role` or `owner_id`.
- All multi-table writes (`save_workout_plan`, `save_diet_plan`, `copy_*`, `set_active_plan`, `delete_plan`, `ensure_today`, `update_*_completion`, `log_water`, `delete_my_account`) execute inside `SECURITY DEFINER` RPC functions that verify `auth.uid()`, ownership, and admin status server-side.
- Only the Supabase **publishable / anon** key is used in frontend code. Never expose the service-role key.

## Setup

### 1. Database Migrations (Supabase SQL Editor)

Run these two SQL files in order inside your Supabase project's **SQL Editor**:

1. `supabase/migrations/001_initial_schema.sql` — tables, constraints, triggers, RLS, RPC functions, and `avatars` storage bucket.
2. `supabase/migrations/002_seed_premade_plans.sql` — seeds starter premade workout and diet plans.

### 2. Promote an Administrator (Trusted DB Operation)

Never assign admin via frontend UI. Run this in the Supabase SQL Editor after creating your account:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE username = 'your_username';
```

### 3. Environment Variables

Copy `.env.example` to `.env` and set your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

### 4. Local Development

```bash
npm install
npm run dev
```

### 5. Deploy to GitHub + Vercel

1. Push the `fitpulse/` directory (or repo root with Root Directory set to `fitpulse`) to GitHub.
2. Import the repository in Vercel.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel Project Settings → Environment Variables.
4. Deploy (`vercel.json` handles client-side SPA routing).
5. In Supabase **Authentication → URL Configuration**, add your Vercel domain to **Site URL** and **Redirect URLs** (`https://your-app.vercel.app/reset-password`).
