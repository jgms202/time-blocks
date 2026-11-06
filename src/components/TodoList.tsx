import { useState } from 'react'
import { Check, Lock, X } from 'lucide-react'
import { Project, Todo } from '../lib/model'

export interface TodoActions {
  add: (projectId: string, text: string) => void
  toggle: (projectId: string, todoId: string) => void
  rename: (projectId: string, todoId: string, text: string) => void
  remove: (projectId: string, todoId: string) => void
}

interface Props {
  project: Project
  actions: TodoActions
  /** Shown when another project's block is running. To-dos can still be planned, not ticked. */
  lockMessage: string | null
}

export default function TodoList({ project, actions, lockMessage }: Props) {
  const [draft, setDraft] = useState('')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    actions.add(project.id, text)
    setDraft('')
  }

  return (
    <div className="tb-todos">
      {lockMessage && (
        <p className="tb-lock-note">
          <Lock size={12} /> {lockMessage}
        </p>
      )}
      {project.todos.length > 0 && (
        <ul className="tb-todo-list">
          {project.todos.map((todo) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              projectId={project.id}
              actions={actions}
              locked={lockMessage !== null}
            />
          ))}
        </ul>
      )}
      <form onSubmit={submit}>
        <input
          className="tb-input tb-todo-add"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a to-do"
          aria-label={`Add a to-do to ${project.name}`}
        />
      </form>
    </div>
  )
}

function TodoRow({
  todo,
  projectId,
  actions,
  locked,
}: {
  todo: Todo
  projectId: string
  actions: TodoActions
  locked: boolean
}) {
  const [editing, setEditing] = useState(false)

  function commit(value: string) {
    const text = value.trim()
    if (text && text !== todo.text) actions.rename(projectId, todo.id, text)
    setEditing(false)
  }

  return (
    <li className={todo.done ? 'tb-todo is-done' : 'tb-todo'}>
      <button
        className="tb-check"
        role="checkbox"
        aria-checked={todo.done}
        aria-label={todo.text}
        disabled={locked}
        title={locked ? 'Locked until this project has a running block or free time' : undefined}
        onClick={() => actions.toggle(projectId, todo.id)}
      >
        {todo.done && <Check size={11} strokeWidth={3} />}
      </button>
      {editing ? (
        <input
          className="tb-input tb-todo-edit"
          defaultValue={todo.text}
          autoFocus
          aria-label="Edit to-do"
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit(event.currentTarget.value)
            if (event.key === 'Escape') {
              event.stopPropagation()
              setEditing(false)
            }
          }}
        />
      ) : (
        <button className="tb-todo-text" onClick={() => setEditing(true)} title="Click to edit">
          {todo.text}
        </button>
      )}
      <button
        className="tb-todo-remove"
        aria-label={`Delete ${todo.text}`}
        onClick={() => actions.remove(projectId, todo.id)}
      >
        <X size={13} />
      </button>
    </li>
  )
}
