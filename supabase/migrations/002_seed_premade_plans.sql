-- =====================================================================
-- FitPulse — Migration 002: Seed Premade Workout & Diet Plans
-- Run once after 001_initial_schema.sql in Supabase SQL Editor.
-- Idempotent: skips plans that already exist by name + is_premade.
-- =====================================================================

do $$
begin
  -- 1. Premade Workout: 6-Day Push Pull Legs (Intermediate)
  if not exists (
    select 1 from public.workout_plans where is_premade = true and name = 'Push Pull Legs (6-Day)'
  ) then
    perform public._upsert_workout_plan(
      null, null,
      '{
        "name": "Push Pull Legs (6-Day)",
        "description": "Classic 6-day hypertrophy split hitting every major muscle group twice per week with Sunday recovery.",
        "duration_days": 7,
        "difficulty": "Intermediate",
        "category": "Hypertrophy",
        "equipment": "Full Gym (Barbell, Dumbbells, Cables)",
        "visibility": "public",
        "days": [
          {
            "weekday": 0, "title": "Push A (Chest, Shoulders, Triceps)", "is_rest_day": false,
            "exercises": [
              {"exercise_name": "Barbell Bench Press", "sets": 4, "reps": 8, "target_weight": 60, "rest_seconds": 120, "instructions": "Lower bar to mid-chest with controlled tempo, drive feet into floor."},
              {"exercise_name": "Incline Dumbbell Press", "sets": 3, "reps": 10, "target_weight": 22, "rest_seconds": 90, "instructions": "30-degree bench angle, full stretch at bottom."},
              {"exercise_name": "Overhead Dumbbell Press", "sets": 3, "reps": 10, "target_weight": 16, "rest_seconds": 90, "instructions": "Brace core, press straight overhead without arching lower back."},
              {"exercise_name": "Lateral Raises", "sets": 3, "reps": 15, "target_weight": 8, "rest_seconds": 60, "instructions": "Lead with elbows up to shoulder height."},
              {"exercise_name": "Cable Triceps Pushdown", "sets": 3, "reps": 12, "target_weight": 25, "rest_seconds": 60, "instructions": "Keep elbows pinned to ribs."}
            ]
          },
          {
            "weekday": 1, "title": "Pull A (Back & Biceps)", "is_rest_day": false,
            "exercises": [
              {"exercise_name": "Deadlift", "sets": 3, "reps": 5, "target_weight": 100, "rest_seconds": 180, "instructions": "Hinge hips back, keep bar close to shins, neutral spine."},
              {"exercise_name": "Lat Pulldown", "sets": 4, "reps": 10, "target_weight": 50, "rest_seconds": 90, "instructions": "Pull elbows down toward hips, squeeze lats."},
              {"exercise_name": "Seated Cable Row", "sets": 3, "reps": 12, "target_weight": 45, "rest_seconds": 90, "instructions": "Pull to lower sternum, pause 1 second."},
              {"exercise_name": "Face Pulls", "sets": 3, "reps": 15, "target_weight": 15, "rest_seconds": 60, "instructions": "Pull rope toward forehead with external rotation."},
              {"exercise_name": "Barbell Bicep Curl", "sets": 3, "reps": 12, "target_weight": 25, "rest_seconds": 60, "instructions": "Avoid swinging torso."}
            ]
          },
          {
            "weekday": 2, "title": "Legs A (Quads & Calves)", "is_rest_day": false,
            "exercises": [
              {"exercise_name": "Barbell Back Squat", "sets": 4, "reps": 8, "target_weight": 80, "rest_seconds": 150, "instructions": "Break at hips and knees together, squat to parallel or below."},
              {"exercise_name": "Romanian Deadlift", "sets": 3, "reps": 10, "target_weight": 60, "rest_seconds": 120, "instructions": "Soft knees, feel stretch in hamstrings."},
              {"exercise_name": "Leg Press", "sets": 3, "reps": 12, "target_weight": 120, "rest_seconds": 90, "instructions": "Do not lock out knees at top."},
              {"exercise_name": "Walking Lunges", "sets": 3, "reps": 12, "target_weight": 14, "rest_seconds": 90, "instructions": "12 reps per leg, upright torso."},
              {"exercise_name": "Standing Calf Raises", "sets": 4, "reps": 15, "target_weight": 40, "rest_seconds": 60, "instructions": "Full stretch at bottom, pause at top."}
            ]
          },
          {
            "weekday": 3, "title": "Push B (Shoulders & Chest)", "is_rest_day": false,
            "exercises": [
              {"exercise_name": "Overhead Barbell Press", "sets": 4, "reps": 8, "target_weight": 40, "rest_seconds": 120, "instructions": "Press bar in straight line past face."},
              {"exercise_name": "Dumbbell Bench Press", "sets": 3, "reps": 10, "target_weight": 24, "rest_seconds": 90, "instructions": "Control descent, touch outer chest."},
              {"exercise_name": "Cable Chest Fly", "sets": 3, "reps": 15, "target_weight": 15, "rest_seconds": 60, "instructions": "Slight elbow bend, squeeze pecs together."},
              {"exercise_name": "Overhead Triceps Extension", "sets": 3, "reps": 12, "target_weight": 20, "rest_seconds": 60, "instructions": "Full long-head stretch behind head."}
            ]
          },
          {
            "weekday": 4, "title": "Pull B (Upper Back & Arms)", "is_rest_day": false,
            "exercises": [
              {"exercise_name": "Pull-Ups", "sets": 4, "reps": 8, "rest_seconds": 120, "instructions": "Full dead hang to chin over bar."},
              {"exercise_name": "Chest-Supported Dumbbell Row", "sets": 4, "reps": 10, "target_weight": 22, "rest_seconds": 90, "instructions": "Drive elbows back toward hips."},
              {"exercise_name": "Reverse Pec Deck", "sets": 3, "reps": 15, "target_weight": 25, "rest_seconds": 60, "instructions": "Target rear delts without shrugging."},
              {"exercise_name": "Hammer Curls", "sets": 3, "reps": 12, "target_weight": 14, "rest_seconds": 60, "instructions": "Neutral grip, controlled lowering."}
            ]
          },
          {
            "weekday": 5, "title": "Legs B (Posterior Chain & Core)", "is_rest_day": false,
            "exercises": [
              {"exercise_name": "Bulgarian Split Squat", "sets": 3, "reps": 10, "target_weight": 16, "rest_seconds": 90, "instructions": "10 reps per leg, lean slightly forward for glutes."},
              {"exercise_name": "Lying Leg Curl", "sets": 4, "reps": 12, "target_weight": 35, "rest_seconds": 60, "instructions": "Keep hips pressed into pad."},
              {"exercise_name": "Leg Extension", "sets": 3, "reps": 15, "target_weight": 45, "rest_seconds": 60, "instructions": "Pause 1 second at full extension."},
              {"exercise_name": "Hanging Leg Raises", "sets": 3, "reps": 12, "rest_seconds": 60, "instructions": "Curl pelvis up slowly, avoid swinging."}
            ]
          },
          {"weekday": 6, "title": "Rest & Mobility", "is_rest_day": true, "exercises": []}
        ]
      }'::jsonb,
      true, null
    );
  end if;

  -- 2. Premade Workout: 5-Day Beginner Strength & Conditioning
  if not exists (
    select 1 from public.workout_plans where is_premade = true and name = 'Beginner 5-Day Foundation'
  ) then
    perform public._upsert_workout_plan(
      null, null,
      '{
        "name": "Beginner 5-Day Foundation",
        "description": "Structured 5-day weekday program combining upper/lower strength work with an active recovery Wednesday.",
        "duration_days": 5,
        "difficulty": "Beginner",
        "category": "Strength",
        "equipment": "Dumbbells & Bodyweight",
        "visibility": "public",
        "days": [
          {
            "weekday": 0, "title": "Upper Body A", "is_rest_day": false,
            "exercises": [
              {"exercise_name": "Push-Ups", "sets": 3, "reps": 12, "rest_seconds": 60, "instructions": "Hands slightly wider than shoulders, straight body line."},
              {"exercise_name": "Dumbbell Bent-Over Row", "sets": 3, "reps": 12, "target_weight": 12, "rest_seconds": 75, "instructions": "Flat back, pull dumbbells to waist."},
              {"exercise_name": "Seated Dumbbell Shoulder Press", "sets": 3, "reps": 10, "target_weight": 10, "rest_seconds": 75},
              {"exercise_name": "Dumbbell Bicep Curl", "sets": 2, "reps": 12, "target_weight": 8, "rest_seconds": 60}
            ]
          },
          {
            "weekday": 1, "title": "Lower Body A", "is_rest_day": false,
            "exercises": [
              {"exercise_name": "Goblet Squat", "sets": 3, "reps": 12, "target_weight": 16, "rest_seconds": 90, "instructions": "Hold dumbbell at chest, elbows inside knees."},
              {"exercise_name": "Dumbbell Romanian Deadlift", "sets": 3, "reps": 12, "target_weight": 14, "rest_seconds": 90},
              {"exercise_name": "Glute Bridge", "sets": 3, "reps": 15, "rest_seconds": 60},
              {"exercise_name": "Plank Hold (reps = seconds)", "sets": 3, "reps": 45, "rest_seconds": 60}
            ]
          },
          {"weekday": 2, "title": "Active Recovery / Rest", "is_rest_day": true, "exercises": []},
          {
            "weekday": 3, "title": "Upper Body B", "is_rest_day": false,
            "exercises": [
              {"exercise_name": "Dumbbell Floor Press", "sets": 3, "reps": 12, "target_weight": 14, "rest_seconds": 75},
              {"exercise_name": "Single-Arm Dumbbell Row", "sets": 3, "reps": 10, "target_weight": 14, "rest_seconds": 75},
              {"exercise_name": "Lateral Raises", "sets": 3, "reps": 12, "target_weight": 5, "rest_seconds": 60},
              {"exercise_name": "Bench Dips", "sets": 3, "reps": 12, "rest_seconds": 60}
            ]
          },
          {
            "weekday": 4, "title": "Full Body Conditioning", "is_rest_day": false,
            "exercises": [
              {"exercise_name": "Reverse Lunges", "sets": 3, "reps": 10, "target_weight": 10, "rest_seconds": 75},
              {"exercise_name": "Dumbbell Thrusters", "sets": 3, "reps": 10, "target_weight": 8, "rest_seconds": 90},
              {"exercise_name": "Mountain Climbers", "sets": 3, "reps": 20, "rest_seconds": 60},
              {"exercise_name": "Dead Bug", "sets": 3, "reps": 12, "rest_seconds": 45}
            ]
          }
        ]
      }'::jsonb,
      true, null
    );
  end if;

  -- 3. Premade Diet: Balanced High-Protein Indian & Global (7-Day)
  if not exists (
    select 1 from public.diet_plans where is_premade = true and name = 'Balanced High-Protein (7-Day)'
  ) then
    perform public._upsert_diet_plan(
      null, null,
      '{
        "name": "Balanced High-Protein (7-Day)",
        "description": "Sustainable whole-food nutrition template targeting ~2,200 kcal and ~140g protein per day for lean muscle gain or body recomposition.",
        "duration_days": 7,
        "difficulty": "Beginner",
        "category": "High Protein",
        "visibility": "public",
        "days": [
          {
            "weekday": 0, "title": "Monday — Training Day",
            "meals": [
              {"meal_name": "Breakfast", "scheduled_time": "08:00", "notes": "Hydrate with 500ml water first", "items": [
                {"food_name": "Rolled Oats", "quantity": "70g", "calories": 265, "protein": 9, "carbohydrates": 47, "fats": 5},
                {"food_name": "Low-Fat Milk", "quantity": "250ml", "calories": 110, "protein": 8, "carbohydrates": 12, "fats": 3},
                {"food_name": "Whey / Plant Protein", "quantity": "1 scoop", "calories": 120, "protein": 24, "carbohydrates": 3, "fats": 1},
                {"food_name": "Banana", "quantity": "1 medium", "calories": 105, "protein": 1, "carbohydrates": 27, "fats": 0}
              ]},
              {"meal_name": "Lunch", "scheduled_time": "13:00", "items": [
                {"food_name": "Steamed Rice", "quantity": "200g cooked", "calories": 260, "protein": 5, "carbohydrates": 56, "fats": 1},
                {"food_name": "Yellow Dal", "quantity": "1 bowl", "calories": 180, "protein": 11, "carbohydrates": 26, "fats": 4},
                {"food_name": "Grilled Paneer / Tofu", "quantity": "150g", "calories": 340, "protein": 27, "carbohydrates": 5, "fats": 22}
              ]},
              {"meal_name": "Pre-Workout Snack", "scheduled_time": "17:00", "items": [
                {"food_name": "Greek Yogurt", "quantity": "150g", "calories": 130, "protein": 15, "carbohydrates": 8, "fats": 4},
                {"food_name": "Mixed Berries", "quantity": "80g", "calories": 45, "protein": 1, "carbohydrates": 11, "fats": 0}
              ]},
              {"meal_name": "Dinner", "scheduled_time": "20:30", "items": [
                {"food_name": "Whole Wheat Roti", "quantity": "2 pieces", "calories": 210, "protein": 7, "carbohydrates": 42, "fats": 2},
                {"food_name": "Grilled Chicken / Soya Chunks", "quantity": "160g", "calories": 280, "protein": 36, "carbohydrates": 6, "fats": 8},
                {"food_name": "Sauteed Vegetables", "quantity": "1 bowl", "calories": 110, "protein": 4, "carbohydrates": 14, "fats": 4}
              ]}
            ]
          },
          {
            "weekday": 1, "title": "Tuesday — Training Day",
            "meals": [
              {"meal_name": "Breakfast", "scheduled_time": "08:00", "items": [
                {"food_name": "Scrambled Eggs / Tofu Bhurji", "quantity": "3 eggs / 150g", "calories": 260, "protein": 22, "carbohydrates": 4, "fats": 17},
                {"food_name": "Whole Grain Toast", "quantity": "2 slices", "calories": 180, "protein": 7, "carbohydrates": 32, "fats": 2}
              ]},
              {"meal_name": "Lunch", "scheduled_time": "13:00", "items": [
                {"food_name": "Quinoa / Brown Rice Bowl", "quantity": "200g cooked", "calories": 240, "protein": 8, "carbohydrates": 44, "fats": 3},
                {"food_name": "Grilled Chicken / Chickpea Curry", "quantity": "180g", "calories": 320, "protein": 38, "carbohydrates": 14, "fats": 10},
                {"food_name": "Cucumber Salad", "quantity": "1 bowl", "calories": 45, "protein": 2, "carbohydrates": 9, "fats": 0}
              ]},
              {"meal_name": "Evening Snack", "scheduled_time": "17:00", "items": [
                {"food_name": "Roasted Almonds", "quantity": "25g", "calories": 145, "protein": 5, "carbohydrates": 5, "fats": 13},
                {"food_name": "Apple", "quantity": "1 medium", "calories": 95, "protein": 0, "carbohydrates": 25, "fats": 0}
              ]},
              {"meal_name": "Dinner", "scheduled_time": "20:30", "items": [
                {"food_name": "Paneer / Fish Tikka", "quantity": "180g", "calories": 350, "protein": 35, "carbohydrates": 6, "fats": 18},
                {"food_name": "Mixed Veg Stir-Fry", "quantity": "200g", "calories": 130, "protein": 4, "carbohydrates": 18, "fats": 5},
                {"food_name": "Curd", "quantity": "150g", "calories": 95, "protein": 6, "carbohydrates": 8, "fats": 4}
              ]}
            ]
          },
          {
            "weekday": 2, "title": "Wednesday — Training Day",
            "meals": [
              {"meal_name": "Breakfast", "scheduled_time": "08:00", "items": [
                {"food_name": "Protein Smoothie (Oats, Banana, Milk, Protein)", "quantity": "1 tall glass", "calories": 480, "protein": 38, "carbohydrates": 62, "fats": 8}
              ]},
              {"meal_name": "Lunch", "scheduled_time": "13:00", "items": [
                {"food_name": "Whole Wheat Roti", "quantity": "2 pieces", "calories": 210, "protein": 7, "carbohydrates": 42, "fats": 2},
                {"food_name": "Rajma / Lentil Curry", "quantity": "1 bowl", "calories": 240, "protein": 13, "carbohydrates": 38, "fats": 4},
                {"food_name": "Grilled Paneer / Chicken", "quantity": "150g", "calories": 280, "protein": 30, "carbohydrates": 4, "fats": 14}
              ]},
              {"meal_name": "Snack", "scheduled_time": "17:00", "items": [
                {"food_name": "Boiled Eggs / Roasted Chana", "quantity": "2 eggs / 50g", "calories": 160, "protein": 13, "carbohydrates": 12, "fats": 7}
              ]},
              {"meal_name": "Dinner", "scheduled_time": "20:30", "items": [
                {"food_name": "Sweet Potato", "quantity": "200g", "calories": 180, "protein": 4, "carbohydrates": 41, "fats": 0},
                {"food_name": "Lean Protein Stir-Fry", "quantity": "180g", "calories": 320, "protein": 36, "carbohydrates": 10, "fats": 12}
              ]}
            ]
          },
          {
            "weekday": 3, "title": "Thursday — Training Day",
            "meals": [
              {"meal_name": "Breakfast", "scheduled_time": "08:00", "items": [
                {"food_name": "Moong Dal Chilla", "quantity": "2 pieces", "calories": 280, "protein": 18, "carbohydrates": 38, "fats": 6},
                {"food_name": "Greek Yogurt", "quantity": "150g", "calories": 130, "protein": 15, "carbohydrates": 8, "fats": 4}
              ]},
              {"meal_name": "Lunch", "scheduled_time": "13:00", "items": [
                {"food_name": "Steamed Rice", "quantity": "200g cooked", "calories": 260, "protein": 5, "carbohydrates": 56, "fats": 1},
                {"food_name": "Soya / Chicken Curry", "quantity": "180g", "calories": 310, "protein": 36, "carbohydrates": 12, "fats": 11}
              ]},
              {"meal_name": "Snack", "scheduled_time": "17:00", "items": [
                {"food_name": "Peanut Butter on Whole Wheat Toast", "quantity": "1 slice + 1 tbsp", "calories": 190, "protein": 8, "carbohydrates": 18, "fats": 9}
              ]},
              {"meal_name": "Dinner", "scheduled_time": "20:30", "items": [
                {"food_name": "Whole Wheat Roti", "quantity": "2 pieces", "calories": 210, "protein": 7, "carbohydrates": 42, "fats": 2},
                {"food_name": "Palak Paneer / Tofu", "quantity": "200g", "calories": 320, "protein": 24, "carbohydrates": 10, "fats": 20}
              ]}
            ]
          },
          {
            "weekday": 4, "title": "Friday — Training Day",
            "meals": [
              {"meal_name": "Breakfast", "scheduled_time": "08:00", "items": [
                {"food_name": "Overnight Oats with Chia & Protein", "quantity": "1 jar", "calories": 440, "protein": 34, "carbohydrates": 52, "fats": 10}
              ]},
              {"meal_name": "Lunch", "scheduled_time": "13:00", "items": [
                {"food_name": "Grilled Protein Wrap", "quantity": "1 large wrap", "calories": 480, "protein": 38, "carbohydrates": 48, "fats": 14},
                {"food_name": "Buttermilk / Chaas", "quantity": "250ml", "calories": 70, "protein": 4, "carbohydrates": 6, "fats": 3}
              ]},
              {"meal_name": "Snack", "scheduled_time": "17:00", "items": [
                {"food_name": "Banana & Protein Shake", "quantity": "1 serving", "calories": 225, "protein": 25, "carbohydrates": 30, "fats": 1}
              ]},
              {"meal_name": "Dinner", "scheduled_time": "20:30", "items": [
                {"food_name": "Dal Khichdi with Vegetables", "quantity": "1 large bowl", "calories": 380, "protein": 15, "carbohydrates": 62, "fats": 7},
                {"food_name": "Grilled Paneer / Chicken Side", "quantity": "120g", "calories": 230, "protein": 26, "carbohydrates": 3, "fats": 11}
              ]}
            ]
          },
          {
            "weekday": 5, "title": "Saturday — Training Day",
            "meals": [
              {"meal_name": "Breakfast", "scheduled_time": "08:30", "items": [
                {"food_name": "Omelette / Besan Chilla with Veggies", "quantity": "1 large", "calories": 320, "protein": 24, "carbohydrates": 20, "fats": 16},
                {"food_name": "Fruit Bowl", "quantity": "150g", "calories": 90, "protein": 1, "carbohydrates": 22, "fats": 0}
              ]},
              {"meal_name": "Lunch", "scheduled_time": "13:30", "items": [
                {"food_name": "High-Protein Pasta / Rice Bowl", "quantity": "1 plate", "calories": 550, "protein": 38, "carbohydrates": 68, "fats": 12}
              ]},
              {"meal_name": "Snack", "scheduled_time": "17:30", "items": [
                {"food_name": "Greek Yogurt & Walnuts", "quantity": "150g + 15g", "calories": 230, "protein": 17, "carbohydrates": 10, "fats": 14}
              ]},
              {"meal_name": "Dinner", "scheduled_time": "20:30", "items": [
                {"food_name": "Tandoori Chicken / Paneer", "quantity": "200g", "calories": 360, "protein": 38, "carbohydrates": 6, "fats": 18},
                {"food_name": "Green Salad & Mint Chutney", "quantity": "1 bowl", "calories": 70, "protein": 3, "carbohydrates": 12, "fats": 1}
              ]}
            ]
          },
          {
            "weekday": 6, "title": "Sunday — Recovery Day",
            "meals": [
              {"meal_name": "Breakfast", "scheduled_time": "09:00", "items": [
                {"food_name": "Protein Pancakes with Honey", "quantity": "3 pancakes", "calories": 420, "protein": 32, "carbohydrates": 50, "fats": 10}
              ]},
              {"meal_name": "Lunch", "scheduled_time": "13:30", "items": [
                {"food_name": "Balanced Home Thali (Roti, Dal, Sabzi, Curd, Paneer)", "quantity": "1 plate", "calories": 650, "protein": 32, "carbohydrates": 78, "fats": 20}
              ]},
              {"meal_name": "Dinner", "scheduled_time": "20:00", "items": [
                {"food_name": "Warm Lentil Soup & Grilled Protein", "quantity": "1 bowl + 150g", "calories": 420, "protein": 38, "carbohydrates": 36, "fats": 12}
              ]}
            ]
          }
        ]
      }'::jsonb,
      true, null
    );
  end if;
end $$;
