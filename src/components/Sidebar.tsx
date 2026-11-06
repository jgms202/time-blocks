import { useRef, useState } from 'react'
import { ChevronDown, Pencil, Plus, Settings as SettingsIcon, Trash2 } from 'lucide-react'
import {
  AppData,
  formatTime,
  activeBlock,
  nextBlock,
  PALETTE,
  Project,
  Settings as SettingsData,
  Theme,
} from '../lib/model'
import TodoList, { TodoActions } from './TodoList'

type ProjectPatch = Partial<Pick<Project, 'name' | 'color' | 'oneOff'>>

interface Props {
  data: AppData
  now: Date
  brushId: string | null
  todoActions: TodoActions
  lockMessageFor: (projectId: string) => string | null
  onBrushChange: (projectId: string) => void
  onAddProject: (name: string, oneOff: boolean) => void
  onUpdateProject: (projectId: string, patch: ProjectPatch) => void
  onDeleteProject: (projectId: string) => void
  onSettingsChange: (patch: Partial<SettingsData>) => void
  onTestAlarm: () => void
  account: { email: string; signOut: () => void } | null
  onExport: () => void
  onImport: (file: File) => void
}

export default function Sidebar(props: Props) {
  const { data, brushId, onBrushChange } = props
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  function handleRowClick(projectId: string) {
    onBrushChange(projectId)
    setExpandedId((current) => (current === projectId ? null : projectId))
  }

  return (
    <aside className="tb-sidebar">
      <NowCard {...props} />

      <section className="tb-projects">
        <div className="tb-section-head">
          <h2>Projects</h2>
          <button
            className="tb-icon-button"
            aria-label="New project"
            onClick={() => setAdding((value) => !value)}
          >
            <Plus size={16} />
          </button>
        </div>

        {(adding || data.projects.length === 0) && (
          <NewProjectForm
            onSubmit={(name, oneOff) => {
              props.onAddProject(name, oneOff)
              setAdding(false)
            }}
          />
        )}

        {data.projects.length > 0 && (
          <p className="tb-hint">Pick a project, then click or drag on the calendar to block out time.</p>
        )}

        <ul className="tb-project-list">
          {data.projects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              isBrush={project.id === brushId}
              isExpanded={project.id === expandedId}
              onClick={() => handleRowClick(project.id)}
              lockMessage={props.lockMessageFor(project.id)}
              todoActions={props.todoActions}
              onUpdate={(patch) => props.onUpdateProject(project.id, patch)}
              onDelete={() => props.onDeleteProject(project.id)}
            />
          ))}
        </ul>
      </section>

      <footer className="tb-sidebar-foot">
        {settingsOpen && <SettingsPanel {...props} />}
        <button
          className="tb-text-button"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <SettingsIcon size={14} /> Settings
        </button>
      </footer>
    </aside>
  )
}

function NowCard({ data, now, todoActions, lockMessageFor }: Props) {
  const active = activeBlock(data.blocks, now)
  const project = active && data.projects.find((p) => p.id === active.projectId)

  if (active && project) {
    return (
      <section className="tb-now" style={{ '--tb-project': project.color } as React.CSSProperties}>
        <p className="tb-now-label">Now, until {formatTime(new Date(active.end))}</p>
        <h2 className="tb-now-project">{project.name}</h2>
        <TodoList project={project} actions={todoActions} lockMessage={lockMessageFor(project.id)} />
      </section>
    )
  }

  const next = nextBlock(data.blocks, now)
  const nextProject = next && data.projects.find((p) => p.id === next.projectId)
  return (
    <section className="tb-now is-free">
      <p className="tb-now-label">No block running</p>
      {next && nextProject ? (
        <p className="tb-now-next">
          <span className="tb-dot" style={{ background: nextProject.color }} />
          Next: {nextProject.name},{' '}
          {new Date(next.start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}{' '}
          at {formatTime(new Date(next.start))}
        </p>
      ) : (
        <p className="tb-now-next">Nothing planned yet.</p>
      )}
    </section>
  )
}

function NewProjectForm({ onSubmit }: { onSubmit: (name: string, oneOff: boolean) => void }) {
  const [name, setName] = useState('')
  const [oneOff, setOneOff] = useState(false)
  return (
    <form
      className="tb-new-project"
      onSubmit={(event) => {
        event.preventDefault()
        const trimmed = name.trim()
        if (!trimmed) return
        onSubmit(trimmed, oneOff)
        setName('')
        setOneOff(false)
      }}
    >
      <input
        className="tb-input"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="New project name"
        aria-label="New project name"
        autoFocus
      />
      <label className="tb-oneoff-option">
        <input type="checkbox" checked={oneOff} onChange={(event) => setOneOff(event.target.checked)} />
        Theme: name and tick each block
      </label>
    </form>
  )
}

function ProjectRow({
  project,
  isBrush,
  isExpanded,
  onClick,
  lockMessage,
  todoActions,
  onUpdate,
  onDelete,
}: {
  project: Project
  isBrush: boolean
  isExpanded: boolean
  onClick: () => void
  lockMessage: string | null
  todoActions: TodoActions
  onUpdate: (patch: ProjectPatch) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const remaining = project.todos.filter((todo) => !todo.done).length

  return (
    <li className={isBrush ? 'tb-project is-brush' : 'tb-project'}>
      <button className="tb-project-row" aria-expanded={isExpanded} aria-pressed={isBrush} onClick={onClick}>
        <span className="tb-dot" style={{ background: project.color }} />
        <span className="tb-project-name">{project.name}</span>
        {remaining > 0 && <span className="tb-count">{remaining}</span>}
        <ChevronDown size={14} className={isExpanded ? 'tb-chevron is-open' : 'tb-chevron'} />
      </button>

      {isExpanded && (
        <div className="tb-project-body">
          <TodoList project={project} actions={todoActions} lockMessage={lockMessage} />
          <button className="tb-text-button" onClick={() => setEditing((value) => !value)} aria-expanded={editing}>
            <Pencil size={12} /> Edit project
          </button>
          {editing && (
            <div className="tb-project-edit">
              <input
                key={project.name}
                className="tb-input"
                defaultValue={project.name}
                aria-label="Project name"
                onBlur={(event) => {
                  const name = event.target.value.trim()
                  if (name && name !== project.name) onUpdate({ name })
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
              />
              <div className="tb-swatches" role="group" aria-label="Project colour">
                {PALETTE.map((color) => (
                  <button
                    key={color}
                    className={color === project.color.toLowerCase() ? 'tb-swatch is-active' : 'tb-swatch'}
                    style={{ background: color }}
                    aria-label={`Colour ${color}`}
                    aria-pressed={color === project.color.toLowerCase()}
                    onClick={() => onUpdate({ color })}
                  />
                ))}
                <input
                  type="color"
                  className="tb-color-input"
                  value={project.color}
                  aria-label="Custom colour"
                  onChange={(event) => onUpdate({ color: event.target.value })}
                />
              </div>
              <label className="tb-oneoff-option">
                <input
                  type="checkbox"
                  checked={Boolean(project.oneOff)}
                  onChange={(event) => onUpdate({ oneOff: event.target.checked })}
                />
                Theme: name and tick each block
              </label>
              <button className="tb-text-button is-danger" onClick={onDelete}>
                <Trash2 size={12} /> Delete project and its blocks
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

const HOURS = Array.from({ length: 25 }, (_, hour) => hour)
const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

function SettingsPanel({ data, onSettingsChange, onTestAlarm, account, onExport, onImport }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const { dayStartHour, dayEndHour, focusLock, theme } = data.settings

  return (
    <div className="tb-settings">
      <label className="tb-setting">
        <span>Day starts</span>
        <select
          className="tb-input"
          value={dayStartHour}
          onChange={(event) => onSettingsChange({ dayStartHour: Number(event.target.value) })}
        >
          {HOURS.filter((hour) => hour < dayEndHour).map((hour) => (
            <option key={hour} value={hour}>
              {String(hour).padStart(2, '0')}:00
            </option>
          ))}
        </select>
      </label>
      <label className="tb-setting">
        <span>Day ends</span>
        <select
          className="tb-input"
          value={dayEndHour}
          onChange={(event) => onSettingsChange({ dayEndHour: Number(event.target.value) })}
        >
          {HOURS.filter((hour) => hour > dayStartHour).map((hour) => (
            <option key={hour} value={hour}>
              {String(hour).padStart(2, '0')}:00
            </option>
          ))}
        </select>
      </label>
      <label className="tb-setting">
        <span>Theme</span>
        <select
          className="tb-input"
          value={theme}
          onChange={(event) => onSettingsChange({ theme: event.target.value as Theme })}
        >
          {THEMES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="tb-setting">
        <span title="While a block runs, only its project's to-dos can be ticked off">Focus lock</span>
        <input
          type="checkbox"
          checked={focusLock}
          onChange={(event) => onSettingsChange({ focusLock: event.target.checked })}
        />
      </label>
      <div className="tb-setting-actions">
        <button className="tb-button" onClick={onTestAlarm}>
          Test alarm sound
        </button>
      </div>
      <div className="tb-setting-actions">
        <button className="tb-button" onClick={onExport}>
          Save backup
        </button>
        <button className="tb-button" onClick={() => fileInput.current?.click()}>
          Restore
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          aria-label="Backup file"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onImport(file)
            event.target.value = ''
          }}
        />
      </div>
      {account && (
        <div className="tb-account">
          <span title={account.email}>{account.email}</span>
          <button className="tb-text-button" onClick={account.signOut}>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
