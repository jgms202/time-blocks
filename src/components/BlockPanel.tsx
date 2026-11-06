import { Check, Trash2, X } from 'lucide-react'
import { AppData, Block, formatTime } from '../lib/model'
import TodoList, { TodoActions } from './TodoList'

interface Props {
  block: Block
  data: AppData
  now: Date
  todoActions: TodoActions
  lockMessageFor: (projectId: string) => string | null
  onChangeProject: (blockId: string, projectId: string) => void
  onRename: (blockId: string, title: string) => void
  onToggleDone: (blockId: string) => void
  onDelete: (blockId: string) => void
  onClose: () => void
}

export default function BlockPanel({
  block,
  data,
  now,
  todoActions,
  lockMessageFor,
  onChangeProject,
  onRename,
  onToggleDone,
  onDelete,
  onClose,
}: Props) {
  const project = data.projects.find((p) => p.id === block.projectId)
  if (!project) return null

  const start = new Date(block.start)
  const end = new Date(block.end)
  const isNow = start <= now && now < end
  const day = start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <aside
      className="tb-panel"
      aria-label="Time block"
      style={{ '--tb-project': project.color } as React.CSSProperties}
    >
      <div className="tb-panel-head">
        <p className="tb-now-label">{isNow ? 'Running now' : day}</p>
        <button className="tb-icon-button" aria-label="Close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <h2 className="tb-now-project">{project.name}</h2>
      <p className="tb-panel-time">
        {formatTime(start)} to {formatTime(end)}
      </p>

      {project.oneOff && (
        <div className="tb-oneoff">
          <input
            key={block.id}
            className="tb-input"
            value={block.title ?? ''}
            placeholder="Name this block, such as Long run"
            aria-label="Block name"
            autoFocus={!block.title}
            onChange={(event) => onRename(block.id, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onClose()
            }}
          />
          <button
            className={block.done ? 'tb-oneoff-done is-done' : 'tb-oneoff-done'}
            role="checkbox"
            aria-checked={Boolean(block.done)}
            onClick={() => onToggleDone(block.id)}
          >
            <span className="tb-check">{block.done && <Check size={11} strokeWidth={3} />}</span>
            Done
          </button>
        </div>
      )}

      <h3 className="tb-panel-subhead">To-do list</h3>
      <TodoList project={project} actions={todoActions} lockMessage={lockMessageFor(project.id)} />

      <div className="tb-panel-foot">
        <label className="tb-setting">
          <span>Project</span>
          <select
            className="tb-input"
            value={project.id}
            onChange={(event) => onChangeProject(block.id, event.target.value)}
          >
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button className="tb-text-button is-danger" onClick={() => onDelete(block.id)}>
          <Trash2 size={12} /> Delete this block
        </button>
      </div>
    </aside>
  )
}
