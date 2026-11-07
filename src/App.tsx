import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BlockPanel from './components/BlockPanel'
import CalendarView from './components/CalendarView'
import Sidebar from './components/Sidebar'
import { TodoActions } from './components/TodoList'
import {
  activeBlock,
  AppData,
  Block,
  copyWeek,
  fitNewBlock,
  formatTime,
  laterRepeats,
  CLICK_BLOCK_MS,
  newId,
  nextColor,
  parseData,
  Project,
  repeatWeekly,
  Settings,
  visibleHours,
} from './lib/model'
import {
  BackupState,
  isBackupDue,
  protectStorage,
  readBackupState,
  recordBackup,
  snoozeBackupReminder,
} from './lib/backup'
import { useAlarm } from './lib/useAlarm'
import { Store } from './lib/store'

interface Toast {
  message: string
  undo?: AppData
}

export default function App({ store }: { store: Store }) {
  const { data, update, saveFailed, notice, account } = store
  const [brushId, setBrushId] = useState<string | null>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [copiedWeek, setCopiedWeek] = useState<Date | null>(null)
  const [backup, setBackup] = useState<BackupState>(readBackupState)
  const [storageProtected, setStorageProtected] = useState<boolean | null>(null)
  const now = useNow()
  // Backups and storage protection only matter when data lives in this browser.
  const savesToBrowser = !account
  const backupDue = savesToBrowser && isBackupDue(backup, now, data.blocks.length > 0)

  useEffect(() => {
    if (savesToBrowser) protectStorage().then(setStorageProtected)
  }, [savesToBrowser])

  // The chosen project, falling back to the first one if it was deleted or none was chosen.
  const brush = data.projects.find((p) => p.id === brushId) ?? data.projects[0] ?? null
  const selectedBlock = data.blocks.find((b) => b.id === selectedBlockId) ?? null

  const alarm = useAlarm(data.blocks, data.settings.alarmOn)

  useEffect(() => {
    if (notice) setToast({ message: notice.message })
  }, [notice])

  useTheme(data.settings.theme)
  useToastTimeout(toast, setToast)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedBlockId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const updateProject = useCallback(
    (projectId: string, change: (project: Project) => Project) =>
      update((d) => ({ ...d, projects: d.projects.map((p) => (p.id === projectId ? change(p) : p)) })),
    [update],
  )

  const todoActions: TodoActions = useMemo(
    () => ({
      add: (projectId, text) =>
        updateProject(projectId, (p) => ({
          ...p,
          todos: [...p.todos, { id: newId(), text, done: false }],
        })),
      toggle: (projectId, todoId) =>
        updateProject(projectId, (p) => ({
          ...p,
          todos: p.todos.map((t) => (t.id === todoId ? { ...t, done: !t.done } : t)),
        })),
      rename: (projectId, todoId, text) =>
        updateProject(projectId, (p) => ({
          ...p,
          todos: p.todos.map((t) => (t.id === todoId ? { ...t, text } : t)),
        })),
      remove: (projectId, todoId) =>
        updateProject(projectId, (p) => ({ ...p, todos: p.todos.filter((t) => t.id !== todoId) })),
    }),
    [updateProject],
  )

  function lockMessageFor(projectId: string): string | null {
    if (!data.settings.focusLock) return null
    const active = activeBlock(data.blocks, now)
    if (!active || active.projectId === projectId) return null
    const name = data.projects.find((p) => p.id === active.projectId)?.name
    return `Locked until ${formatTime(new Date(active.end))}: this is ${name} time.`
  }

  function addProject(name: string, oneOff: boolean) {
    const id = newId()
    update((d) => ({
      ...d,
      projects: [
        ...d.projects,
        { id, name, color: nextColor(d.projects), todos: [], ...(oneOff ? { oneOff: true } : {}) },
      ],
    }))
    setBrushId(id)
  }

  function deleteProject(projectId: string) {
    const project = data.projects.find((p) => p.id === projectId)
    const undo = data
    update((d) => ({
      ...d,
      projects: d.projects.filter((p) => p.id !== projectId),
      blocks: d.blocks.filter((b) => b.projectId !== projectId),
    }))
    setToast({ message: `Deleted ${project?.name}.`, undo })
  }

  function handleSelectRange(start: Date, end: Date) {
    // With a block open, a plain click on the grid just closes it instead of adding a block.
    if (selectedBlock && end.getTime() - start.getTime() < CLICK_BLOCK_MS) {
      setSelectedBlockId(null)
      return
    }
    setSelectedBlockId(null)
    if (!brush) {
      setToast({ message: 'Create a project first, then block out time for it.' })
      return
    }
    const { startHour, endHour } = visibleHours(data)
    const fit = fitNewBlock(start, end, data.blocks, startHour, endHour)
    if (!fit) {
      setToast({ message: 'There isn’t a free half hour there.' })
      return
    }
    const id = newId()
    update((d) => ({
      ...d,
      blocks: [
        ...d.blocks,
        { id, projectId: brush.id, start: fit.start.toISOString(), end: fit.end.toISOString() },
      ],
    }))
    // Themes open the new block straight away so it can be named.
    if (brush.oneOff) setSelectedBlockId(id)
  }

  function changeBlock(blockId: string, patch: Partial<Block>) {
    update((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)) }))
  }

  function toggleBlockDone(blockId: string) {
    const block = data.blocks.find((b) => b.id === blockId)
    if (block) changeBlock(blockId, { done: !block.done })
  }

  function toggleAlarm() {
    const on = !data.settings.alarmOn
    changeSettings({ alarmOn: on })
    if (on) alarm.confirm()
    else alarm.stop()
  }

  function moveBlock(blockId: string, start: Date, end: Date) {
    update((d) => ({
      ...d,
      blocks: d.blocks.map((b) =>
        b.id === blockId ? { ...b, start: start.toISOString(), end: end.toISOString() } : b,
      ),
    }))
  }

  function changeBlockProject(blockId: string, projectId: string) {
    update((d) => ({
      ...d,
      blocks: d.blocks.map((b) => (b.id === blockId ? { ...b, projectId } : b)),
    }))
  }

  function handleCopyWeek(monday: Date) {
    const nextMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7)
    const count = data.blocks.filter((b) => {
      const start = new Date(b.start)
      return start >= monday && start < nextMonday
    }).length
    if (!count) {
      setToast({ message: 'This week has no blocks to copy.' })
      return
    }
    setCopiedWeek(monday)
    setToast({ message: `Copied ${plural(count, 'block')}. Go to another week and click Paste week.` })
  }

  function handlePasteWeek(monday: Date) {
    if (!copiedWeek) return
    if (copiedWeek.getTime() === monday.getTime()) {
      setToast({ message: 'Go to another week first, then paste.' })
      return
    }
    const { added, skipped } = copyWeek(data.blocks, copiedWeek, monday)
    const skippedNote = skipped ? ` Skipped ${plural(skipped, 'block')} that would overlap.` : ''
    if (!added.length) {
      setToast({ message: `Nothing pasted.${skippedNote}` })
      return
    }
    const undo = data
    update((d) => ({ ...d, blocks: [...d.blocks, ...added] }))
    setToast({ message: `Pasted ${plural(added.length, 'block')}.${skippedNote}`, undo })
  }

  function repeatBlock(blockId: string, weeks: number, everyWeeks: number) {
    const block = data.blocks.find((b) => b.id === blockId)
    if (!block) return
    const { repeatId, added, skipped } = repeatWeekly(data.blocks, block, weeks, everyWeeks)
    const skippedNote = skipped ? ` Skipped ${plural(skipped, 'week')} where that time is taken.` : ''
    if (!added.length) {
      setToast({ message: `Nothing added.${skippedNote}` })
      return
    }
    const undo = data
    update((d) => ({
      ...d,
      blocks: [...d.blocks.map((b) => (b.id === blockId ? { ...b, repeatId } : b)), ...added],
    }))
    setToast({ message: `Added ${plural(added.length, 'repeat')}.${skippedNote}`, undo })
  }

  function deleteLaterRepeats(blockId: string) {
    const block = data.blocks.find((b) => b.id === blockId)
    if (!block) return
    const ids = new Set(laterRepeats(data.blocks, block).map((b) => b.id))
    const undo = data
    update((d) => ({ ...d, blocks: d.blocks.filter((b) => !ids.has(b.id)) }))
    setSelectedBlockId(null)
    setToast({ message: `Deleted ${plural(ids.size, 'block')}.`, undo })
  }

  function deleteBlock(blockId: string) {
    const undo = data
    update((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== blockId) }))
    setSelectedBlockId(null)
    setToast({ message: 'Block deleted.', undo })
  }

  function changeSettings(patch: Partial<Settings>) {
    update((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
  }

  function exportBackup() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `time-blocks-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setBackup(recordBackup(new Date()))
  }

  async function importBackup(file: File) {
    try {
      const imported = parseData(JSON.parse(await file.text()))
      const undo = data
      update(() => imported)
      setSelectedBlockId(null)
      setToast({ message: 'Backup restored.', undo })
    } catch {
      setToast({ message: 'That file isn’t a Time Blocks backup. Nothing was changed.' })
    }
  }

  return (
    <div className="tb-app">
      <Sidebar
        data={data}
        now={now}
        brushId={brush?.id ?? null}
        todoActions={todoActions}
        lockMessageFor={lockMessageFor}
        onBrushChange={setBrushId}
        onAddProject={addProject}
        onUpdateProject={(projectId, patch) => updateProject(projectId, (p) => ({ ...p, ...patch }))}
        onDeleteProject={deleteProject}
        onSettingsChange={changeSettings}
        onTestAlarm={alarm.test}
        account={account ?? null}
        onExport={exportBackup}
        onImport={importBackup}
        backup={savesToBrowser ? { due: backupDue, last: backup.last, protected: storageProtected } : null}
        onSnoozeBackup={() => setBackup(snoozeBackupReminder(new Date()))}
      />
      <CalendarView
        data={data}
        now={now}
        brush={brush}
        selectedBlockId={selectedBlockId}
        onViewChange={(view) => changeSettings({ view })}
        onSelectRange={handleSelectRange}
        onBlockClick={setSelectedBlockId}
        onToggleDone={toggleBlockDone}
        alarmArmed={alarm.armed}
        onToggleAlarm={toggleAlarm}
        onBlockMove={moveBlock}
        onRejectedChange={(message) => setToast({ message })}
        copiedWeek={copiedWeek}
        onCopyWeek={handleCopyWeek}
        onPasteWeek={handlePasteWeek}
        onCancelCopy={() => setCopiedWeek(null)}
      />
      {selectedBlock && (
        <BlockPanel
          block={selectedBlock}
          data={data}
          now={now}
          todoActions={todoActions}
          lockMessageFor={lockMessageFor}
          onChangeProject={changeBlockProject}
          onRename={(blockId, title) => changeBlock(blockId, { title })}
          onToggleDone={toggleBlockDone}
          onRepeat={repeatBlock}
          onDelete={deleteBlock}
          onDeleteLaterRepeats={deleteLaterRepeats}
          onClose={() => setSelectedBlockId(null)}
        />
      )}
      {saveFailed && (
        <div className="tb-toast is-error" role="alert">
          Your latest changes aren&rsquo;t saved yet. Save a backup from Settings before closing.
        </div>
      )}
      {alarm.playing && (
        <div className="tb-toast tb-toast-alarm" role="alert">
          <span>Time block change</span>
          <button className="tb-toast-undo" onClick={alarm.stop}>
            Stop sound
          </button>
        </div>
      )}
      {toast && !saveFailed && !alarm.playing && (
        <div className="tb-toast" role="status">
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              className="tb-toast-undo"
              onClick={() => {
                const previous = toast.undo!
                update(() => previous)
                setToast(null)
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

/** The current time, refreshed often enough for blocks to start and end on time. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

function useTheme(theme: Settings['theme']) {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.dataset.colorScheme = dark ? 'dark' : 'light'
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}

function useToastTimeout(toast: Toast | null, setToast: (toast: Toast | null) => void) {
  const latest = useRef(setToast)
  latest.current = setToast
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => latest.current(null), toast.undo ? 8000 : 4000)
    return () => clearTimeout(timer)
  }, [toast])
}
