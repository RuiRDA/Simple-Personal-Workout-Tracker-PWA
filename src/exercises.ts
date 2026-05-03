import type { ExerciseUnit } from './db'

export type ExerciseDefinition = {
  id: string
  label: string
  unit: ExerciseUnit
  presets: number[]
}

export const DEFAULT_EXERCISES: ExerciseDefinition[] = [
  {
    id: 'pushups',
    label: 'Pushups',
    unit: 'reps',
    presets: [5, 10, 20],
  },
  {
    id: 'situps',
    label: 'Situps',
    unit: 'reps',
    presets: [10, 20, 30],
  },
  {
    id: 'crunches',
    label: 'Crunches',
    unit: 'reps',
    presets: [10, 25, 50],
  },
  {
    id: 'squats',
    label: 'Squats',
    unit: 'reps',
    presets: [10, 20, 50],
  },
  {
    id: 'plank',
    label: 'Plank',
    unit: 'seconds',
    presets: [30, 60, 90],
  },
  {
    id: 'pullups',
    label: 'Pullups',
    unit: 'reps',
    presets: [3, 5, 10],
  },
  {
    id: 'bicep_curls',
    label: 'Bicep Curls',
    unit: 'reps',
    presets: [8, 10, 12],
  },
]

export const exerciseById = new Map(
  DEFAULT_EXERCISES.map((exercise) => [exercise.id, exercise]),
)

export function getExerciseLabel(exerciseId: string) {
  return exerciseById.get(exerciseId)?.label ?? exerciseId
}
