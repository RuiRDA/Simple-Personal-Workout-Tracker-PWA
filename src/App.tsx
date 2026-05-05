import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'
import {
  dateKeyToLocalDate,
  db,
  deleteLog,
  exportCsv,
  exportJson,
  formatAmount,
  formatDateLabel,
  formatTime,
  getAllLogs,
  getLogsForDate,
  importJsonLogs,
  logExercise,
  timestampForDateKey,
  toLocalDateKey,
  type ExerciseLog,
  type ExerciseUnit,
} from './db'
import {
  DEFAULT_QUICK_EXERCISE_IDS,
  EXERCISE_LIBRARY,
  exerciseById,
  getExerciseLabel,
  sortExerciseIds,
  type ExerciseDefinition,
} from './exercises'

type Tab = 'quick' | 'day' | 'dashboard' | 'export' | 'settings'

type Toast = {
  log: ExerciseLog
  message: string
}

type ChartPoint = {
  date: string
  label: string
  totalReps: number
  totalSeconds: number
  cumulativeReps: number
  selectedDaily: number
  selectedCumulative: number
  activeExercises: number
  [exerciseId: string]: string | number
}

type ChartTooltipProps = {
  active?: boolean
  label?: string
  payload?: {
    color?: string
    dataKey?: string | number
    name?: string
    value?: number
  }[]
}

const tabs: { id: Tab; label: string }[] = [
  { id: 'quick', label: 'Quick' },
  { id: 'day', label: 'Day' },
  { id: 'dashboard', label: 'Charts' },
  { id: 'export', label: 'Data' },
  { id: 'settings', label: 'Settings' },
]

const chartMargins = { top: 12, right: 8, bottom: 0, left: -18 }
const axisStyle = { fill: 'var(--chart-muted)', fontSize: 12, fontWeight: 700 }
const chartWindowDays = 14
const quickExercisesStorageKey = 'workout-tracker.quick-exercises.v1'
const exerciseColors = [
  '#22c55e',
  '#38bdf8',
  '#f97316',
  '#a78bfa',
  '#f43f5e',
  '#eab308',
  '#14b8a6',
  '#fb7185',
]

function exerciseSeriesKey(exerciseId: string) {
  return `exercise_${exerciseId}`
}

function loadQuickExerciseIds() {
  if (typeof window === 'undefined') {
    return DEFAULT_QUICK_EXERCISE_IDS
  }

  try {
    const stored = window.localStorage.getItem(quickExercisesStorageKey)
    const parsed = stored ? (JSON.parse(stored) as unknown) : null

    if (!Array.isArray(parsed)) {
      return DEFAULT_QUICK_EXERCISE_IDS
    }

    const validIds = parsed.filter(
      (exerciseId): exerciseId is string =>
        typeof exerciseId === 'string' && exerciseById.has(exerciseId),
    )

    return validIds.length > 0
      ? sortExerciseIds([...new Set(validIds)])
      : DEFAULT_QUICK_EXERCISE_IDS
  } catch {
    return DEFAULT_QUICK_EXERCISE_IDS
  }
}

function getExerciseGroups(exercises: ExerciseDefinition[]) {
  return exercises.reduce<Record<string, ExerciseDefinition[]>>(
    (groups, exercise) => {
      groups[exercise.category] = [...(groups[exercise.category] ?? []), exercise]
      return groups
    },
    {},
  )
}

function totalsByExercise(logs: ExerciseLog[]) {
  return logs.reduce<Record<string, number>>((totals, log) => {
    totals[log.exercise] = (totals[log.exercise] ?? 0) + log.amount
    return totals
  }, {})
}

function downloadText(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function shiftDate(dateKey: string, days: number) {
  const date = dateKeyToLocalDate(dateKey)
  date.setDate(date.getDate() + days)
  return toLocalDateKey(date)
}

function formatChartLabel(dateKey: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(dateKeyToLocalDate(dateKey))
}

function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) {
    return null
  }

  const seen = new Set<string | number>()
  const uniqueEntries = payload.filter((entry) => {
    const key = entry.dataKey ?? entry.name ?? ''
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return typeof entry.value === 'number'
  })
  const visibleEntries = uniqueEntries.filter((entry) => entry.value !== 0)
  const entries = visibleEntries.length > 0 ? visibleEntries : uniqueEntries

  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {entries.map((entry) => (
        <span key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </span>
      ))}
    </div>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('quick')
  const [logs, setLogs] = useState<ExerciseLog[]>([])
  const [selectedDate, setSelectedDate] = useState(toLocalDateKey(new Date()))
  const [selectedLogs, setSelectedLogs] = useState<ExerciseLog[]>([])
  const [toast, setToast] = useState<Toast | null>(null)
  const [quickExerciseIds, setQuickExerciseIds] = useState(loadQuickExerciseIds)
  const [customExercise, setCustomExercise] = useState(
    DEFAULT_QUICK_EXERCISE_IDS[0],
  )
  const [customAmount, setCustomAmount] = useState('')
  const [chartExercise, setChartExercise] = useState('pushups')
  const [exerciseFilter, setExerciseFilter] = useState('')
  const [importStatus, setImportStatus] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const todayKey = toLocalDateKey(new Date())
  const isToday = selectedDate === todayKey

  useEffect(() => {
    window.localStorage.setItem(
      quickExercisesStorageKey,
      JSON.stringify(quickExerciseIds),
    )
  }, [quickExerciseIds])

  const refreshLogs = useCallback(async (dateKey = selectedDate) => {
    const [allLogs, dayLogs] = await Promise.all([
      getAllLogs(),
      getLogsForDate(dateKey),
    ])
    setLogs(allLogs)
    setSelectedLogs(dayLogs)
  }, [selectedDate])

  useEffect(() => {
    queueMicrotask(() => {
      void refreshLogs(selectedDate)
    })
  }, [refreshLogs, selectedDate])

  async function handleLog(
    exercise: string,
    amount: number,
    unit: ExerciseUnit,
  ) {
    const savedLog = await logExercise(
      exercise,
      amount,
      unit,
      timestampForDateKey(selectedDate),
    )
    setToast({
      log: savedLog,
      message: `Saved +${amount} ${getExerciseLabel(exercise)} for ${formatDateLabel(
        selectedDate,
      )}`,
    })
    await refreshLogs(selectedDate)
  }

  async function handleUndo() {
    if (!toast) return

    await deleteLog(toast.log.id)
    setToast(null)
    await refreshLogs(selectedDate)
  }

  async function handleDelete(id: string) {
    await deleteLog(id)
    if (toast?.log.id === id) {
      setToast(null)
    }
    await refreshLogs(selectedDate)
  }

  async function handleCustomSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const exercise = exerciseById.get(customExercise)
    const amount = Number(customAmount)

    if (!exercise || !Number.isFinite(amount) || amount <= 0) {
      return
    }

    await handleLog(exercise.id, amount, exercise.unit)
    setCustomAmount('')
  }

  async function handleExportJson() {
    downloadText('workout-logs.json', await exportJson(), 'application/json')
  }

  async function handleExportCsv() {
    downloadText('workout-logs.csv', await exportCsv(), 'text/csv')
  }

  async function handleImport(file: File | undefined) {
    if (!file) return

    try {
      const imported = await importJsonLogs(await file.text())
      setImportStatus(`Imported ${imported} logs`)
      await refreshLogs(selectedDate)
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : 'Import failed')
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  async function handleClearAll() {
    if (!window.confirm('Clear all workout logs? This cannot be undone.')) {
      return
    }

    await db.logs.clear()
    setToast(null)
    setImportStatus('All logs cleared')
    await refreshLogs(selectedDate)
  }

  function handleQuickExerciseToggle(exerciseId: string) {
    setQuickExerciseIds((exerciseIds) => {
      if (exerciseIds.includes(exerciseId)) {
        return exerciseIds.length > 1
          ? exerciseIds.filter((id) => id !== exerciseId)
          : exerciseIds
      }

      return sortExerciseIds([...exerciseIds, exerciseId])
    })
  }

  function handleResetQuickExercises() {
    setQuickExerciseIds(DEFAULT_QUICK_EXERCISE_IDS)
  }

  const selectedTotals = useMemo(
    () => totalsByExercise(selectedLogs),
    [selectedLogs],
  )

  const quickExercises = useMemo(
    () =>
      quickExerciseIds
        .map((exerciseId) => exerciseById.get(exerciseId))
        .filter((exercise): exercise is ExerciseDefinition => Boolean(exercise)),
    [quickExerciseIds],
  )

  const quickExerciseSet = useMemo(
    () => new Set(quickExerciseIds),
    [quickExerciseIds],
  )

  const daySummary = useMemo(() => {
    const exerciseIds = sortExerciseIds(Object.keys(selectedTotals))

    return exerciseIds
      .map((exerciseId) => {
        const exercise = exerciseById.get(exerciseId)
        const unit =
          exercise?.unit ??
          selectedLogs.find((log) => log.exercise === exerciseId)?.unit ??
          'reps'

        return {
          id: exerciseId,
          label: exercise?.label ?? exerciseId,
          total: selectedTotals[exerciseId] ?? 0,
          unit,
        }
      })
      .filter((exercise) => exercise.total > 0)
  }, [selectedLogs, selectedTotals])

  const quickStats = useMemo(() => {
    const reps = selectedLogs
      .filter((log) => log.unit === 'reps')
      .reduce((total, log) => total + log.amount, 0)
    const seconds = selectedLogs
      .filter((log) => log.unit === 'seconds')
      .reduce((total, log) => total + log.amount, 0)

    return { reps, seconds, entries: selectedLogs.length }
  }, [selectedLogs])

  const loggedExerciseIds = useMemo(
    () => sortExerciseIds([...new Set(logs.map((log) => log.exercise))]),
    [logs],
  )

  const chartExercises = useMemo(
    () =>
      loggedExerciseIds
        .map((exerciseId) => exerciseById.get(exerciseId))
        .filter((exercise): exercise is ExerciseDefinition => Boolean(exercise)),
    [loggedExerciseIds],
  )

  const exerciseGroups = useMemo(
    () => getExerciseGroups(EXERCISE_LIBRARY),
    [],
  )

  const filteredExerciseGroups = useMemo(() => {
    const query = exerciseFilter.trim().toLowerCase()

    if (!query) {
      return exerciseGroups
    }

    return getExerciseGroups(
      EXERCISE_LIBRARY.filter((exercise) =>
        `${exercise.label} ${exercise.category}`.toLowerCase().includes(query),
      ),
    )
  }, [exerciseFilter, exerciseGroups])

  const chartData = useMemo<ChartPoint[]>(() => {
    const emptyExerciseTotals = Object.fromEntries(
      chartExercises.map((exercise) => [exerciseSeriesKey(exercise.id), 0]),
    )

    const totals = logs.reduce<Record<string, ChartPoint>>((days, log) => {
      const date = toLocalDateKey(log.timestamp)
      days[date] ??= {
        date,
        label: formatChartLabel(date),
        totalReps: 0,
        totalSeconds: 0,
        cumulativeReps: 0,
        selectedDaily: 0,
        selectedCumulative: 0,
        activeExercises: 0,
        ...emptyExerciseTotals,
      }

      if (log.unit === 'reps') {
        days[date].totalReps += log.amount
      } else {
        days[date].totalSeconds += log.amount
      }

      if (log.exercise === chartExercise) {
        days[date].selectedDaily += log.amount
      }

      const seriesKey = exerciseSeriesKey(log.exercise)
      days[date][seriesKey] = Number(days[date][seriesKey] ?? 0) + log.amount

      return days
    }, {})

    const endDate = dateKeyToLocalDate(todayKey)

    const result = Array.from({ length: chartWindowDays }).reduce<{
      cumulativeReps: number
      days: ChartPoint[]
      selectedCumulative: number
    }>((progress, _, index) => {
      const date = new Date(endDate)
      date.setDate(endDate.getDate() - (chartWindowDays - 1 - index))
      const key = toLocalDateKey(date)
      const point =
        totals[key] ?? {
          date: key,
          label: formatChartLabel(key),
          totalReps: 0,
          totalSeconds: 0,
          cumulativeReps: 0,
          selectedDaily: 0,
          selectedCumulative: 0,
          activeExercises: 0,
          ...emptyExerciseTotals,
        }

      const cumulativeReps = progress.cumulativeReps + point.totalReps
      const selectedCumulative =
        progress.selectedCumulative + point.selectedDaily
      const activeExercises = chartExercises.filter(
        (exercise) => Number(point[exerciseSeriesKey(exercise.id)] ?? 0) > 0,
      ).length

      return {
        cumulativeReps,
        days: [
          ...progress.days,
          {
            ...point,
            activeExercises,
            cumulativeReps,
            selectedCumulative,
          },
        ],
        selectedCumulative,
      }
    }, {
      cumulativeReps: 0,
      days: [],
      selectedCumulative: 0,
    })

    return result.days
  }, [chartExercise, chartExercises, logs, todayKey])

  const chartSummary = useMemo(() => {
    const activeDays = chartData.filter(
      (day) => day.totalReps > 0 || day.totalSeconds > 0,
    ).length
    const periodReps = chartData.reduce((total, day) => total + day.totalReps, 0)
    const periodSeconds = chartData.reduce(
      (total, day) => total + day.totalSeconds,
      0,
    )
    const exerciseTotals = chartExercises.map((exercise) => ({
      ...exercise,
      total: chartData.reduce(
        (total, day) => total + Number(day[exerciseSeriesKey(exercise.id)] ?? 0),
        0,
      ),
    })).sort((a, b) => b.total - a.total)
    const topExercise = exerciseTotals.find((exercise) => exercise.total > 0)

    return {
      activeDays,
      averageReps: activeDays > 0 ? Math.round(periodReps / activeDays) : 0,
      periodReps,
      periodSeconds,
      topExercise,
    }
  }, [chartData, chartExercises])

  const recentExerciseTotals = useMemo(() => {
    return chartExercises.map((exercise) => ({
      ...exercise,
      total: chartData.reduce(
        (total, day) => total + Number(day[exerciseSeriesKey(exercise.id)] ?? 0),
        0,
      )
    })).filter((exercise) => exercise.total > 0)
  }, [chartData, chartExercises])

  const chartUnit = exerciseById.get(chartExercise)?.unit ?? 'reps'

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Workout Tracker</p>
          <h1>{formatDateLabel(selectedDate)}</h1>
        </div>
        <div className="hero-metrics" aria-label="Selected day totals">
          <span>{quickStats.entries} logs</span>
          <strong>{quickStats.reps} reps</strong>
          {quickStats.seconds > 0 && <span>{quickStats.seconds}s</span>}
        </div>
      </header>

      <section className="date-dock" aria-label="Selected workout day">
        <button
          className="icon-button"
          onClick={() => setSelectedDate((date) => shiftDate(date, -1))}
          type="button"
        >
          Prev
        </button>
        <label className="date-field">
          <span>Log date</span>
          <input
            onChange={(event) => setSelectedDate(event.target.value)}
            type="date"
            value={selectedDate}
          />
        </label>
        <button
          className="icon-button"
          disabled={isToday}
          onClick={() => setSelectedDate((date) => shiftDate(date, 1))}
          type="button"
        >
          Next
        </button>
        <button
          className="today-button"
          disabled={isToday}
          onClick={() => setSelectedDate(todayKey)}
          type="button"
        >
          Today
        </button>
      </section>

      <nav className="tabs" aria-label="App sections">
        {tabs.map((tab) => (
          <button
            aria-current={activeTab === tab.id ? 'page' : undefined}
            className="tab-button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'quick' && (
        <section className="screen">
          {toast && (
            <div className="toast" role="status">
              <span>{toast.message}</span>
              <button className="ghost-button" onClick={handleUndo} type="button">
                Undo
              </button>
            </div>
          )}

          <div className="exercise-grid">
            {quickExercises.map((exercise) => (
              <article className="exercise-card" key={exercise.id}>
                <div className="exercise-card-heading">
                  <div>
                    <h2>{exercise.label}</h2>
                    <p>
                      {formatDateLabel(selectedDate)}:{' '}
                      {formatAmount(selectedTotals[exercise.id] ?? 0, exercise.unit)}
                    </p>
                    {exercise.note && <p className="exercise-note">{exercise.note}</p>}
                  </div>
                  <span>{exercise.unit}</span>
                </div>
                <div className="preset-row">
                  {exercise.presets.map((preset) => (
                    <button
                      className="preset-button"
                      key={preset}
                      onClick={() => handleLog(exercise.id, preset, exercise.unit)}
                      type="button"
                    >
                      +{preset}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <form className="custom-entry" onSubmit={handleCustomSave}>
            <div>
              <h2>Custom entry</h2>
              <p>Saved to {formatDateLabel(selectedDate)}.</p>
            </div>
            <div className="form-row">
              <label>
                <span>Exercise</span>
                <select
                  onChange={(event) => setCustomExercise(event.target.value)}
                  value={customExercise}
                >
                  {Object.entries(exerciseGroups).map(([category, exercises]) => (
                    <optgroup key={category} label={category}>
                      {exercises.map((exercise) => (
                        <option key={exercise.id} value={exercise.id}>
                          {exercise.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label>
                <span>Amount</span>
                <input
                  inputMode="numeric"
                  min="1"
                  onChange={(event) => setCustomAmount(event.target.value)}
                  placeholder="10"
                  type="number"
                  value={customAmount}
                />
              </label>
              <button className="primary-button" type="submit">
                Save
              </button>
            </div>
          </form>
        </section>
      )}

      {activeTab === 'day' && (
        <section className="screen">
          <div className="summary-strip">
            {daySummary.length === 0 ? (
              <p>No logs for {formatDateLabel(selectedDate)}.</p>
            ) : (
              daySummary.map((exercise) => (
                <div className="summary-item" key={exercise.id}>
                  <strong>{exercise.total}</strong>
                  <span>
                    {exercise.label} {exercise.unit}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="timeline">
            <div className="timeline-title">
              <h2>{formatDateLabel(selectedDate)} timeline</h2>
              <span>{selectedLogs.length} entries</span>
            </div>
            {selectedLogs.length === 0 ? (
              <p className="empty-state">Quick logs for this day will show up here.</p>
            ) : (
              selectedLogs.map((log) => (
                <article className="timeline-entry" key={log.id}>
                  <div>
                    <time>{formatTime(log.timestamp)}</time>
                    <strong>{getExerciseLabel(log.exercise)}</strong>
                    <span>{formatAmount(log.amount, log.unit)}</span>
                  </div>
                  <button
                    aria-label={`Delete ${getExerciseLabel(log.exercise)} log`}
                    className="delete-button"
                    onClick={() => handleDelete(log.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {activeTab === 'dashboard' && (
        <section className="screen dashboard-screen">
          <div className="chart-stat-grid">
            <article className="chart-stat-card">
              <span>14-day reps</span>
              <strong>{chartSummary.periodReps}</strong>
              {chartSummary.periodSeconds > 0 && (
                <small>{chartSummary.periodSeconds} seconds</small>
              )}
            </article>
            <article className="chart-stat-card">
              <span>Active days</span>
              <strong>{chartSummary.activeDays}</strong>
            </article>
            <article className="chart-stat-card">
              <span>Daily average</span>
              <strong>{chartSummary.averageReps}</strong>
            </article>
            <article className="chart-stat-card">
              <span>Top exercise</span>
              <strong>{chartSummary.topExercise?.label ?? 'None'}</strong>
              {chartSummary.topExercise && (
                <small>
                  {chartSummary.topExercise.total} {chartSummary.topExercise.unit}
                </small>
              )}
            </article>
          </div>

          <div className="chart-panel feature-chart">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Last 14 days</p>
                <h2>Progress over time</h2>
                <p>Daily reps with a running cumulative total.</p>
              </div>
              <strong>{chartData.at(-1)?.cumulativeReps ?? 0}</strong>
            </div>
            <ResponsiveContainer height={260} width="100%">
              <ComposedChart data={chartData} margin={chartMargins}>
                <defs>
                  <linearGradient id="totalRepsFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis
                  allowDecimals={false}
                  tick={axisStyle}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--chart-cursor)' }} />
                <Area
                  dataKey="cumulativeReps"
                  fill="url(#totalRepsFill)"
                  name="Cumulative reps"
                  stroke="#22c55e"
                  strokeWidth={3}
                  type="monotone"
                />
                <Bar
                  dataKey="totalReps"
                  fill="#14b8a6"
                  name="Daily reps"
                  opacity={0.55}
                  radius={[6, 6, 2, 2]}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-panel feature-chart">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">All exercises</p>
                <h2>Daily trends</h2>
                <p>Tooltip values are daily totals, not cumulative totals.</p>
              </div>
            </div>
            {recentExerciseTotals.length > 0 && (
              <div className="exercise-total-strip">
                {recentExerciseTotals.map((exercise, index) => (
                  <span
                    key={exercise.id}
                    style={{
                      '--series-color': exerciseColors[index % exerciseColors.length],
                    } as CSSProperties}
                  >
                    {exercise.label}: {exercise.total} {exercise.unit}
                  </span>
                ))}
              </div>
            )}
            <ResponsiveContainer height={340} width="100%">
              <ComposedChart data={chartData} margin={{ ...chartMargins, right: 18 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis
                  allowDecimals={false}
                  tick={axisStyle}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--chart-cursor)' }} />
                <Legend
                  iconType="circle"
                  wrapperStyle={{
                    color: 'var(--chart-muted)',
                    fontSize: 12,
                    fontWeight: 800,
                    paddingTop: 12,
                  }}
                />
                {chartExercises.length === 0 ? (
                  <Line dataKey="totalReps" hide name="No logs yet" />
                ) : (
                  chartExercises.map((exercise, index) => (
                    <Line
                      activeDot={{ r: 6, strokeWidth: 0 }}
                      dataKey={exerciseSeriesKey(exercise.id)}
                      dot={{ r: 3, strokeWidth: 0 }}
                      key={exercise.id}
                      name={`${exercise.label} (${exercise.unit})`}
                      stroke={exerciseColors[index % exerciseColors.length]}
                      strokeWidth={3}
                      type="monotone"
                    />
                  ))
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-panel">
            <div className="panel-heading selector-heading">
              <div>
                <p className="eyebrow">Focus</p>
                <h2>{getExerciseLabel(chartExercise)}</h2>
                <p>Daily {chartUnit} with cumulative progress.</p>
              </div>
              <select
                onChange={(event) => setChartExercise(event.target.value)}
                value={chartExercise}
              >
                {Object.entries(exerciseGroups).map(([category, exercises]) => (
                  <optgroup key={category} label={category}>
                    {exercises.map((exercise) => (
                      <option key={exercise.id} value={exercise.id}>
                        {exercise.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <ResponsiveContainer height={240} width="100%">
              <ComposedChart data={chartData} margin={chartMargins}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis
                  allowDecimals={false}
                  tick={axisStyle}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--chart-cursor)' }} />
                <Bar
                  dataKey="selectedDaily"
                  fill="#a78bfa"
                  name={`Daily ${chartUnit}`}
                  radius={[6, 6, 2, 2]}
                />
                <Line
                  dataKey="selectedCumulative"
                  dot={{ fill: '#f97316', r: 4 }}
                  name={`Cumulative ${chartUnit}`}
                  stroke="#f97316"
                  strokeWidth={3}
                  type="monotone"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {activeTab === 'export' && (
        <section className="screen export-screen">
          <article className="tool-card">
            <h2>Export</h2>
            <p>{logs.length} logs stored locally on this device.</p>
            <div className="button-row">
              <button className="primary-button" onClick={handleExportJson} type="button">
                JSON
              </button>
              <button className="primary-button" onClick={handleExportCsv} type="button">
                CSV
              </button>
            </div>
          </article>

          <article className="tool-card">
            <h2>Import JSON</h2>
            <p>Restores logs exported from this app.</p>
            <input
              accept="application/json,.json"
              onChange={(event) => handleImport(event.target.files?.[0])}
              ref={fileInputRef}
              type="file"
            />
            {importStatus && <p className="status-text">{importStatus}</p>}
          </article>

          <article className="tool-card danger-zone">
            <h2>Clear data</h2>
            <p>Deletes every local workout log.</p>
            <button className="danger-button" onClick={handleClearAll} type="button">
              Clear all
            </button>
          </article>
        </section>
      )}

      {activeTab === 'settings' && (
        <section className="screen settings-screen">
          <article className="tool-card settings-card">
            <div className="settings-heading">
              <div>
                <p className="eyebrow">Exercise library</p>
                <h2>Quick Log</h2>
                <p>{quickExerciseIds.length} exercises shown</p>
              </div>
              <button
                className="ghost-button"
                onClick={handleResetQuickExercises}
                type="button"
              >
                Reset
              </button>
            </div>
            <label className="search-field">
              <span>Search exercises</span>
              <input
                onChange={(event) => setExerciseFilter(event.target.value)}
                placeholder="Pushups"
                type="search"
                value={exerciseFilter}
              />
            </label>
          </article>

          <div className="library-list">
            {Object.keys(filteredExerciseGroups).length === 0 ? (
              <p className="empty-state">No exercises found.</p>
            ) : (
              Object.entries(filteredExerciseGroups).map(([category, exercises]) => (
                <section className="library-section" key={category}>
                  <h3>{category}</h3>
                  <div className="library-exercises">
                    {exercises.map((exercise) => {
                      const isSelected = quickExerciseSet.has(exercise.id)
                      const isOnlySelected =
                        isSelected && quickExerciseIds.length === 1

                      return (
                        <label className="exercise-toggle-row" key={exercise.id}>
                          <input
                            checked={isSelected}
                            disabled={isOnlySelected}
                            onChange={() => handleQuickExerciseToggle(exercise.id)}
                            type="checkbox"
                          />
                          <span className="toggle-copy">
                            <strong>{exercise.label}</strong>
                            <small>
                              {exercise.unit} - +{exercise.presets.join(' / +')}
                            </small>
                            {exercise.note && <em>{exercise.note}</em>}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </section>
      )}
    </main>
  )
}

export default App
