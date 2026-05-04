import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { DEFAULT_EXERCISES, exerciseById, getExerciseLabel } from './exercises'

type Tab = 'quick' | 'day' | 'dashboard' | 'export'

type Toast = {
  log: ExerciseLog
  message: string
}

type ChartPoint = {
  date: string
  label: string
  totalReps: number
  pushups: number
  bicep_curls: number
  selected: number
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
]

const chartMargins = { top: 12, right: 8, bottom: 0, left: -18 }
const axisStyle = { fill: 'var(--chart-muted)', fontSize: 12, fontWeight: 700 }
const exerciseColors = [
  '#22c55e',
  '#38bdf8',
  '#f97316',
  '#a78bfa',
  '#f43f5e',
  '#eab308',
  '#14b8a6',
]

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

  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((entry) => (
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
  const [customExercise, setCustomExercise] = useState(DEFAULT_EXERCISES[0].id)
  const [customAmount, setCustomAmount] = useState('')
  const [chartExercise, setChartExercise] = useState('pushups')
  const [importStatus, setImportStatus] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const todayKey = toLocalDateKey(new Date())
  const isToday = selectedDate === todayKey

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

  const selectedTotals = useMemo(
    () => totalsByExercise(selectedLogs),
    [selectedLogs],
  )

  const daySummary = useMemo(() => {
    return DEFAULT_EXERCISES.map((exercise) => ({
      ...exercise,
      total: selectedTotals[exercise.id] ?? 0,
    })).filter((exercise) => exercise.total > 0)
  }, [selectedTotals])

  const quickStats = useMemo(() => {
    const reps = selectedLogs
      .filter((log) => log.unit === 'reps')
      .reduce((total, log) => total + log.amount, 0)
    const seconds = selectedLogs
      .filter((log) => log.unit === 'seconds')
      .reduce((total, log) => total + log.amount, 0)

    return { reps, seconds, entries: selectedLogs.length }
  }, [selectedLogs])

  const chartData = useMemo<ChartPoint[]>(() => {
    const totals = logs.reduce<Record<string, ChartPoint>>((days, log) => {
      const date = toLocalDateKey(log.timestamp)
      days[date] ??= {
        date,
        label: formatChartLabel(date),
        totalReps: 0,
        pushups: 0,
        bicep_curls: 0,
        selected: 0,
        ...Object.fromEntries(
          DEFAULT_EXERCISES.map((exercise) => [exercise.id, 0]),
        ),
      }

      if (log.unit === 'reps') {
        days[date].totalReps += log.amount
      }

      if (log.exercise === 'pushups') {
        days[date].pushups += log.amount
      }

      if (log.exercise === 'bicep_curls') {
        days[date].bicep_curls += log.amount
      }

      if (log.exercise === chartExercise) {
        days[date].selected += log.amount
      }

      days[date][log.exercise] = Number(days[date][log.exercise] ?? 0) + log.amount

      return days
    }, {})

    const endDate = dateKeyToLocalDate(todayKey)
    const days = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(endDate)
      date.setDate(endDate.getDate() - (13 - index))
      const key = toLocalDateKey(date)

      return (
        totals[key] ?? {
          date: key,
          label: formatChartLabel(key),
          totalReps: 0,
          pushups: 0,
          bicep_curls: 0,
          selected: 0,
          ...Object.fromEntries(
            DEFAULT_EXERCISES.map((exercise) => [exercise.id, 0]),
          ),
        }
      )
    })

    return days
  }, [chartExercise, logs, todayKey])

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
            {DEFAULT_EXERCISES.map((exercise) => (
              <article className="exercise-card" key={exercise.id}>
                <div className="exercise-card-heading">
                  <div>
                    <h2>{exercise.label}</h2>
                    <p>
                      {formatDateLabel(selectedDate)}:{' '}
                      {formatAmount(selectedTotals[exercise.id] ?? 0, exercise.unit)}
                    </p>
                    {['bicep_curls', 'arm_raises'].includes(exercise.id) && (
                      <p className="exercise-note">+10 means 10 reps each arm.</p>
                    )}
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
                  {DEFAULT_EXERCISES.map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.label}
                    </option>
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
          <div className="chart-panel feature-chart">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Last 14 days</p>
                <h2>Total reps</h2>
              </div>
              <strong>{chartData.at(-1)?.totalReps ?? 0}</strong>
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
                  dataKey="totalReps"
                  fill="url(#totalRepsFill)"
                  name="Total reps"
                  stroke="#22c55e"
                  strokeWidth={3}
                  type="monotone"
                />
                <Bar
                  dataKey="totalReps"
                  fill="#14b8a6"
                  name="Total reps"
                  opacity={0.55}
                  radius={[6, 6, 2, 2]}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Favorites</p>
                <h2>Pushups vs curls</h2>
              </div>
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
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--chart-cursor)' }} />
                <Bar dataKey="pushups" fill="#38bdf8" name="Pushups" radius={[6, 6, 2, 2]} />
                <Line
                  dataKey="bicep_curls"
                  dot={{ fill: '#f97316', r: 4 }}
                  name="Bicep curls"
                  stroke="#f97316"
                  strokeWidth={3}
                  type="monotone"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-panel feature-chart">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">All exercises</p>
                <h2>Daily trends</h2>
                <p>Each line keeps its own exercise unit.</p>
              </div>
            </div>
            <ResponsiveContainer height={320} width="100%">
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
                {DEFAULT_EXERCISES.map((exercise, index) => (
                  <Line
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    dataKey={exercise.id}
                    dot={{ r: 3, strokeWidth: 0 }}
                    key={exercise.id}
                    name={`${exercise.label} (${exercise.unit})`}
                    stroke={exerciseColors[index % exerciseColors.length]}
                    strokeWidth={3}
                    type="monotone"
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-panel">
            <div className="panel-heading selector-heading">
              <div>
                <p className="eyebrow">Explorer</p>
                <h2>{getExerciseLabel(chartExercise)}</h2>
                <p>Shown in {chartUnit}.</p>
              </div>
              <select
                onChange={(event) => setChartExercise(event.target.value)}
                value={chartExercise}
              >
                {DEFAULT_EXERCISES.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.label}
                  </option>
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
                  dataKey="selected"
                  fill="#a78bfa"
                  name={`${getExerciseLabel(chartExercise)} ${chartUnit}`}
                  radius={[6, 6, 2, 2]}
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
    </main>
  )
}

export default App
