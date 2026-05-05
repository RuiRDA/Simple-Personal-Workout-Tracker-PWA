import type { ExerciseUnit } from './db'

export type ExerciseCategory = 'Upper' | 'Core' | 'Lower' | 'Cardio' | 'Mobility'

export type ExerciseDefinition = {
  category: ExerciseCategory
  id: string
  label: string
  note?: string
  unit: ExerciseUnit
  presets: number[]
}

export const EXERCISE_LIBRARY: ExerciseDefinition[] = [
  {
    category: 'Upper',
    id: 'pushups',
    label: 'Pushups',
    unit: 'reps',
    presets: [5, 10, 20],
  },
  {
    category: 'Core',
    id: 'situps',
    label: 'Situps',
    unit: 'reps',
    presets: [10, 20, 30],
  },
  {
    category: 'Core',
    id: 'crunches',
    label: 'Crunches',
    unit: 'reps',
    presets: [10, 25, 50],
  },
  {
    category: 'Lower',
    id: 'squats',
    label: 'Squats',
    unit: 'reps',
    presets: [10, 20, 50],
  },
  {
    category: 'Core',
    id: 'plank',
    label: 'Plank',
    unit: 'seconds',
    presets: [30, 60, 90],
  },
  {
    category: 'Upper',
    id: 'pullups',
    label: 'Pullups',
    unit: 'reps',
    presets: [3, 5, 10],
  },
  {
    category: 'Upper',
    id: 'bicep_curls',
    label: 'Bicep Curls',
    note: '+10 means 10 reps each arm.',
    unit: 'reps',
    presets: [8, 10, 12],
  },
  {
    category: 'Upper',
    id: 'arm_raises',
    label: 'Arm Raises',
    note: '+10 means 10 reps each arm.',
    unit: 'reps',
    presets: [10, 15, 20],
  },
  {
    category: 'Upper',
    id: 'incline_pushups',
    label: 'Incline Pushups',
    unit: 'reps',
    presets: [5, 10, 15],
  },
  {
    category: 'Upper',
    id: 'diamond_pushups',
    label: 'Diamond Pushups',
    unit: 'reps',
    presets: [3, 5, 10],
  },
  {
    category: 'Upper',
    id: 'pike_pushups',
    label: 'Pike Pushups',
    unit: 'reps',
    presets: [3, 5, 8],
  },
  {
    category: 'Upper',
    id: 'chinups',
    label: 'Chinups',
    unit: 'reps',
    presets: [3, 5, 8],
  },
  {
    category: 'Upper',
    id: 'dips',
    label: 'Dips',
    unit: 'reps',
    presets: [5, 8, 12],
  },
  {
    category: 'Upper',
    id: 'bench_dips',
    label: 'Bench Dips',
    unit: 'reps',
    presets: [8, 12, 20],
  },
  {
    category: 'Upper',
    id: 'shoulder_taps',
    label: 'Shoulder Taps',
    unit: 'reps',
    presets: [10, 20, 30],
  },
  {
    category: 'Upper',
    id: 'hammer_curls',
    label: 'Hammer Curls',
    note: '+10 means 10 reps each arm.',
    unit: 'reps',
    presets: [8, 10, 12],
  },
  {
    category: 'Upper',
    id: 'tricep_extensions',
    label: 'Tricep Extensions',
    unit: 'reps',
    presets: [8, 10, 12],
  },
  {
    category: 'Upper',
    id: 'lateral_raises',
    label: 'Lateral Raises',
    note: '+10 means 10 reps each arm.',
    unit: 'reps',
    presets: [8, 10, 12],
  },
  {
    category: 'Core',
    id: 'leg_raises',
    label: 'Leg Raises',
    unit: 'reps',
    presets: [8, 12, 20],
  },
  {
    category: 'Core',
    id: 'bicycle_crunches',
    label: 'Bicycle Crunches',
    unit: 'reps',
    presets: [10, 20, 30],
  },
  {
    category: 'Core',
    id: 'russian_twists',
    label: 'Russian Twists',
    unit: 'reps',
    presets: [10, 20, 30],
  },
  {
    category: 'Core',
    id: 'mountain_climbers',
    label: 'Mountain Climbers',
    unit: 'reps',
    presets: [20, 40, 60],
  },
  {
    category: 'Core',
    id: 'side_plank',
    label: 'Side Plank',
    unit: 'seconds',
    presets: [20, 30, 45],
  },
  {
    category: 'Core',
    id: 'hollow_hold',
    label: 'Hollow Hold',
    unit: 'seconds',
    presets: [20, 30, 45],
  },
  {
    category: 'Core',
    id: 'flutter_kicks',
    label: 'Flutter Kicks',
    unit: 'reps',
    presets: [20, 30, 50],
  },
  {
    category: 'Core',
    id: 'supermans',
    label: 'Supermans',
    unit: 'reps',
    presets: [10, 15, 20],
  },
  {
    category: 'Lower',
    id: 'lunges',
    label: 'Lunges',
    unit: 'reps',
    presets: [10, 20, 30],
  },
  {
    category: 'Lower',
    id: 'reverse_lunges',
    label: 'Reverse Lunges',
    unit: 'reps',
    presets: [10, 20, 30],
  },
  {
    category: 'Lower',
    id: 'calf_raises',
    label: 'Calf Raises',
    unit: 'reps',
    presets: [15, 25, 40],
  },
  {
    category: 'Lower',
    id: 'glute_bridges',
    label: 'Glute Bridges',
    unit: 'reps',
    presets: [10, 20, 30],
  },
  {
    category: 'Lower',
    id: 'wall_sit',
    label: 'Wall Sit',
    unit: 'seconds',
    presets: [30, 45, 60],
  },
  {
    category: 'Lower',
    id: 'step_ups',
    label: 'Step Ups',
    unit: 'reps',
    presets: [10, 20, 30],
  },
  {
    category: 'Lower',
    id: 'squat_hold',
    label: 'Squat Hold',
    unit: 'seconds',
    presets: [20, 30, 45],
  },
  {
    category: 'Cardio',
    id: 'jumping_jacks',
    label: 'Jumping Jacks',
    unit: 'reps',
    presets: [20, 50, 100],
  },
  {
    category: 'Cardio',
    id: 'burpees',
    label: 'Burpees',
    unit: 'reps',
    presets: [5, 10, 15],
  },
  {
    category: 'Cardio',
    id: 'high_knees',
    label: 'High Knees',
    unit: 'seconds',
    presets: [20, 30, 60],
  },
  {
    category: 'Cardio',
    id: 'jump_rope',
    label: 'Jump Rope',
    unit: 'seconds',
    presets: [30, 60, 120],
  },
  {
    category: 'Cardio',
    id: 'running_in_place',
    label: 'Running in Place',
    unit: 'seconds',
    presets: [30, 60, 120],
  },
  {
    category: 'Mobility',
    id: 'stretching',
    label: 'Stretching',
    unit: 'seconds',
    presets: [60, 120, 300],
  },
  {
    category: 'Mobility',
    id: 'yoga_flow',
    label: 'Yoga Flow',
    unit: 'seconds',
    presets: [60, 180, 300],
  },
]

export const DEFAULT_QUICK_EXERCISE_IDS = [
  'pushups',
  'situps',
  'crunches',
  'squats',
  'plank',
  'pullups',
  'bicep_curls',
  'arm_raises',
]

export const DEFAULT_EXERCISES = EXERCISE_LIBRARY.filter((exercise) =>
  DEFAULT_QUICK_EXERCISE_IDS.includes(exercise.id),
)

export const exerciseById = new Map(
  EXERCISE_LIBRARY.map((exercise) => [exercise.id, exercise]),
)

const exerciseOrder = new Map(
  EXERCISE_LIBRARY.map((exercise, index) => [exercise.id, index]),
)

export function getExerciseLabel(exerciseId: string) {
  return exerciseById.get(exerciseId)?.label ?? exerciseId
}

export function sortExerciseIds(exerciseIds: string[]) {
  return [...exerciseIds].sort(
    (first, second) =>
      (exerciseOrder.get(first) ?? Number.MAX_SAFE_INTEGER) -
        (exerciseOrder.get(second) ?? Number.MAX_SAFE_INTEGER) ||
      first.localeCompare(second),
  )
}
