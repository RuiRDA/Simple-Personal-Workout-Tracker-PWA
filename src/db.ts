import Dexie, { type Table } from 'dexie'

export type ExerciseUnit = 'reps' | 'seconds'

export type ExerciseLog = {
  id: string
  exercise: string
  amount: number
  unit: ExerciseUnit
  timestamp: string
}

export class FitnessDB extends Dexie {
  logs!: Table<ExerciseLog>

  constructor() {
    super('fitness-tracker')
    this.version(1).stores({
      logs: 'id, exercise, timestamp',
    })
  }
}

export const db = new FitnessDB()

export function toLocalDateKey(dateInput: string | Date) {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

export function formatAmount(amount: number, unit: ExerciseUnit) {
  return `${amount} ${unit}`
}

export async function logExercise(
  exercise: string,
  amount: number,
  unit: ExerciseUnit,
) {
  const log: ExerciseLog = {
    id: crypto.randomUUID(),
    exercise,
    amount,
    unit,
    timestamp: new Date().toISOString(),
  }

  await db.logs.add(log)
  return log
}

export async function deleteLog(id: string) {
  await db.logs.delete(id)
}

export async function getTodayLogs() {
  const today = toLocalDateKey(new Date())
  const logs = await getAllLogs()

  return logs.filter((log) => toLocalDateKey(log.timestamp) === today)
}

export async function getAllLogs() {
  return db.logs.orderBy('timestamp').reverse().toArray()
}

export async function getLogsGroupedByDay() {
  const logs = await getAllLogs()

  return logs.reduce<Record<string, ExerciseLog[]>>((days, log) => {
    const day = toLocalDateKey(log.timestamp)
    days[day] = [...(days[day] ?? []), log]
    return days
  }, {})
}

export async function exportJson() {
  const logs = await db.logs.orderBy('timestamp').toArray()
  return JSON.stringify(logs, null, 2)
}

function escapeCsv(value: string | number) {
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export async function exportCsv() {
  const logs = await db.logs.orderBy('timestamp').toArray()
  const rows = logs.map((log) => [
    log.id,
    log.exercise,
    log.amount,
    log.unit,
    log.timestamp,
    toLocalDateKey(log.timestamp),
  ])

  return [
    'id,exercise,amount,unit,timestamp,date',
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\n')
}

export async function importJsonLogs(json: string) {
  const parsed = JSON.parse(json) as ExerciseLog[]

  if (!Array.isArray(parsed)) {
    throw new Error('Import must be a JSON array.')
  }

  const logs = parsed.map((log) => {
    if (
      typeof log.id !== 'string' ||
      typeof log.exercise !== 'string' ||
      typeof log.amount !== 'number' ||
      (log.unit !== 'reps' && log.unit !== 'seconds') ||
      Number.isNaN(new Date(log.timestamp).getTime())
    ) {
      throw new Error('Import contains an invalid log entry.')
    }

    return log
  })

  await db.logs.bulkPut(logs)
  return logs.length
}
