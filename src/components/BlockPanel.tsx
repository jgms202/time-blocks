import { useState } from 'react'
import { Check, Repeat, Trash2, X } from 'lucide-react'
import { AppData, Block, formatTime, laterRepeats } from '../lib/model'
import TodoList, { TodoActions } from './TodoList'

const REPEAT_WEEKS = [4, 8, 12, 26, 52]

interface Props {
  block: Block
  data: AppData
  now: Date
  todoActions: TodoActions
  lockMessageFor: (projectId: string) => string | null
  onChangeProject: (blockId: string, projectId: string) => void
  onRename: (blockId: string, title: string) => void
  onToggleDone: (blockId: string) => void
  onRepeat: (blockId: string, weeks: number, everyWeeks: number) => void
  onDelete: (blockId: string) => void
  onDeleteLaterRepeats: (blockId: string) => void
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
  onRepeat,
  onDelete,
  onDeleteLaterRepeats,
  onClose,
}: Props) {
  const [repeatWeeks, setRepeatWeeks] = useState(12)
  const [everyWeeks, setEveryWeeks] = useState(1)
  const project = data.projects.find((p) => p.id === block.projectId)
  if (!project) return null

  const later = laterRepeats(data.blocks, block)
  const lastRepeat = later.reduce((last, b) => (new Date(b.start) > new Date(last.start) ? b : last), block)

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
        <div className="tb-repeat">
          <span className="tb-repeat-label">Repeat</span>
          <select
            className="tb-input"
            aria-label="How often"
            value={everyWeeks}
            onChange={(event) => setEveryWeeks(Number(event.target.value))}
          >
            <option value={1}>every week</option>
            <option value={2}>every 2 weeks</option>
          </select>
          <select
            className="tb-input"
            aria-label="For how long"
            value={repeatWeeks}
            onChange={(event) => setRepeatWeeks(Number(event.target.value))}
          >
            {REPEAT_WEEKS.map((weeks) => (
              <option key={weeks} value={weeks}>
                for {weeks} weeks
              </option>
            ))}
          </select>
          <button
            className="tb-button"
            aria-label="Repeat"
            onClick={() => onRepeat(block.id, repeatWeeks, everyWeeks)}
          >
            <Repeat size={12} />
          </button>
        </div>
        {block.repeatId && (
          <p className="tb-repeat-note">
            Repeats
            {later.length > 1
              ? `, last on ${new Date(lastRepeat.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
              : ', and this is the last one'}
            .
          </p>
        )}
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
        {later.length > 1 && (
          <button className="tb-text-button is-danger" onClick={() => onDeleteLaterRepeats(block.id)}>
            <Trash2 size={12} /> Delete this and the {later.length - 1} later repeat
            {later.length > 2 ? 's' : ''}
          </button>
        )}
      </div>
    </aside>
  )
}
