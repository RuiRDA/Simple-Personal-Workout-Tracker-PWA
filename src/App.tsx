import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'
import {
  db,
  deleteLog,
  exportCsv,
  exportJson,
  formatAmount,
  formatTime,
  getAllLogs,
  getTodayLogs,
  importJsonLogs,
  logExercise,
  toLocalDateKey,
  type ExerciseLog,
  type ExerciseUnit,
} from './db'
import { DEFAULT_EXERCISES, exerciseById, getExerciseLabel } from './exercises'

type Tab = 'quick' | 'today' | 'dashboard' | 'export'

type Toast = {
  log: ExerciseLog
  message: string
}

const tabs: { id: Tab; label: string }[] = [
  { id: 'quick', label: 'Quick Log' },
  { id: 'today', label: 'Today' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'export', label: 'Export' },
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

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('quick')
  const [logs, setLogs] = useState<ExerciseLog[]>([])
  const [todayLogs, setTodayLogs] = useState<ExerciseLog[]>([])
  const [toast, setToast] = useState<Toast | null>(null)
  const [customExercise, setCustomExercise] = useState(DEFAULT_EXERCISES[0].id)
  const [customAmount, setCustomAmount] = useState('')
  const [chartExercise, setChartExercise] = useState('pushups')
  const [importStatus, setImportStatus] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  async function refreshLogs() {
    const [allLogs, todaysLogs] = await Promise.all([getAllLogs(), getTodayLogs()])
    setLogs(allLogs)
    setTodayLogs(todaysLogs)
  }

  useEffect(() => {
    queueMicrotask(() => {
      void refreshLogs()
    })
  }, [])

  async function handleLog(
    exercise: string,
    amount: number,
    unit: ExerciseUnit,
  ) {
    const savedLog = await logExercise(exercise, amount, unit)
    setToast({
      log: savedLog,
      message: `Saved +${amount} ${getExerciseLabel(exercise)}`,
    })
    await refreshLogs()
  }

  async function handleUndo() {
    if (!toast) return

    await deleteLog(toast.log.id)
    setToast(null)
    await refreshLogs()
  }

  async function handleDelete(id: string) {
    await deleteLog(id)
    if (toast?.log.id === id) {
      setToast(null)
    }
    await refreshLogs()
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
      await refreshLogs()
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
    await refreshLogs()
  }

  const todayTotals = useMemo(() => totalsByExercise(todayLogs), [todayLogs])

  const timelineTotals = useMemo(() => {
    return DEFAULT_EXERCISES.map((exercise) => ({
      ...exercise,
      total: todayTotals[exercise.id] ?? 0,
    })).filter((exercise) => exercise.total > 0)
  }, [todayTotals])

  const chartData = useMemo(() => {
    const byDate = [...logs].reverse().reduce<
      Record<
        string,
        {
          date: string
          totalReps: number
          pushups: number
          bicep_curls: number
          selected: number
        }
      >
    >((days, log) => {
      const date = toLocalDateKey(log.timestamp)
      days[date] ??= {
        date,
        totalReps: 0,
        pushups: 0,
        bicep_curls: 0,
        selected: 0,
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

      return days
    }, {})

    return Object.values(byDate).slice(-14)
  }, [chartExercise, logs])

  const chartUnit = exerciseById.get(chartExercise)?.unit ?? 'reps'

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Workout Tracker</p>
          <h1>Quick sets</h1>
        </div>
        <div className="today-pill">{todayLogs.length} today</div>
      </header>

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
                <div>
                  <h2>{exercise.label}</h2>
                  <p>
                    Today: {formatAmount(todayTotals[exercise.id] ?? 0, exercise.unit)}
                  </p>
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
            <h2>Custom</h2>
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

      {activeTab === 'today' && (
        <section className="screen">
          <div className="summary-strip">
            {timelineTotals.length === 0 ? (
              <p>No logs yet today</p>
            ) : (
              timelineTotals.map((exercise) => (
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
            <h2>Today</h2>
            {todayLogs.length === 0 ? (
              <p className="empty-state">Your taps will show up here.</p>
            ) : (
              todayLogs.map((log) => (
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
          <div className="chart-panel">
            <div className="panel-heading">
              <h2>Total reps per day</h2>
              <p>Seconds-only exercises are excluded.</p>
            </div>
            <ResponsiveContainer height={240} width="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} width={36} />
                <Tooltip />
                <Bar dataKey="totalReps" fill="#2563eb" name="Total reps" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-panel">
            <div className="panel-heading">
              <h2>Favorites</h2>
              <p>Pushups and bicep curls per day.</p>
            </div>
            <ResponsiveContainer height={240} width="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} width={36} />
                <Tooltip />
                <Legend />
                <Bar dataKey="pushups" fill="#16a34a" name="Pushups" radius={[4, 4, 0, 0]} />
                <Bar
                  dataKey="bicep_curls"
                  fill="#f97316"
                  name="Bicep curls"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-panel">
            <div className="panel-heading selector-heading">
              <div>
                <h2>Any exercise</h2>
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
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} width={36} />
                <Tooltip />
                <Bar
                  dataKey="selected"
                  fill="#0f766e"
                  name={`${getExerciseLabel(chartExercise)} ${chartUnit}`}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
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
