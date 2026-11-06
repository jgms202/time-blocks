import { describe, expect, it, vi } from 'vitest'
import { AppData, EMPTY_DATA } from './model'
import { Backend, Remote, SyncEngine } from './sync'

const named = (name: string): AppData => ({
  ...EMPTY_DATA,
  projects: [{ id: name, name, color: '#112233', todos: [] }],
})

function fakeBackend(start: Remote | null = null) {
  const state = { row: start, failing: false, updates: 0 }
  const backend: Backend = {
    fetch: async () => {
      if (state.failing) throw new Error('offline')
      return state.row
    },
    insert: async (data) => {
      if (state.failing) throw new Error('offline')
      if (state.row) throw new Error('exists')
      state.row = { data, revision: 1 }
    },
    update: async (data, revision) => {
      if (state.failing) throw new Error('offline')
      state.updates += 1
      if (!state.row || state.row.revision !== revision) return false
      state.row = { data, revision: revision + 1 }
      return true
    },
  }
  return { state, backend }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
const handlers = () => ({ onRemoteChange: vi.fn(), onSaveStatus: vi.fn() })

describe('SyncEngine', () => {
  it('uses saved data and ignores first-time data when a row exists', async () => {
    const { state, backend } = fakeBackend({ data: named('saved'), revision: 4 })
    const first = vi.fn(() => named('local'))
    const data = await new SyncEngine(backend, handlers()).start(first)
    expect(data.projects[0].name).toBe('saved')
    expect(first).not.toHaveBeenCalled()
    expect(state.row?.revision).toBe(4)
  })

  it('creates the row from first-time data for a new person', async () => {
    const { state, backend } = fakeBackend()
    const data = await new SyncEngine(backend, handlers()).start(() => named('local'))
    expect(data.projects[0].name).toBe('local')
    expect(state.row?.revision).toBe(1)
  })

  it('never overwrites a saved row it cannot read', async () => {
    const { state, backend } = fakeBackend({ data: { nonsense: true }, revision: 2 })
    await expect(new SyncEngine(backend, handlers()).start(() => EMPTY_DATA)).rejects.toThrow()
    expect(state.row?.data).toEqual({ nonsense: true })
    expect(state.updates).toBe(0)
  })

  it('does not treat a failed load as a new person', async () => {
    const { state, backend } = fakeBackend({ data: named('saved'), revision: 2 })
    state.failing = true
    await expect(new SyncEngine(backend, handlers()).start(() => EMPTY_DATA)).rejects.toThrow()
    state.failing = false
    expect(state.row?.data).toEqual(named('saved'))
  })

  it('saves changes in order and keeps only the newest while one is in flight', async () => {
    const { state, backend } = fakeBackend({ data: named('a'), revision: 1 })
    const engine = new SyncEngine(backend, handlers())
    await engine.start(() => EMPTY_DATA)
    engine.save(named('b'))
    engine.save(named('c'))
    engine.save(named('d'))
    await settle()
    await settle()
    expect((state.row?.data as AppData).projects[0].name).toBe('d')
    expect(engine.hasUnsaved).toBe(false)
  })

  it('reports a failed save and keeps the change for a retry', async () => {
    const { state, backend } = fakeBackend({ data: named('a'), revision: 1 })
    const h = handlers()
    const engine = new SyncEngine(backend, h)
    await engine.start(() => EMPTY_DATA)
    state.failing = true
    engine.save(named('b'))
    await settle()
    expect(h.onSaveStatus).toHaveBeenLastCalledWith(true)
    expect(engine.hasUnsaved).toBe(true)
    state.failing = false
    engine.save(named('c'))
    await settle()
    await settle()
    expect(h.onSaveStatus).toHaveBeenLastCalledWith(false)
    expect((state.row?.data as AppData).projects[0].name).toBe('c')
    engine.dispose()
  })

  it('takes the other device\'s version on a conflict and says so', async () => {
    const { state, backend } = fakeBackend({ data: named('a'), revision: 1 })
    const h = handlers()
    const engine = new SyncEngine(backend, h)
    await engine.start(() => EMPTY_DATA)
    state.row = { data: named('other device'), revision: 2 }
    engine.save(named('stale'))
    await settle()
    await settle()
    expect(h.onRemoteChange).toHaveBeenCalledWith(named('other device'), true)
    expect((state.row?.data as AppData).projects[0].name).toBe('other device')
  })

  it('refresh brings in newer data but leaves unsaved work alone', async () => {
    const { state, backend } = fakeBackend({ data: named('a'), revision: 1 })
    const h = handlers()
    const engine = new SyncEngine(backend, h)
    await engine.start(() => EMPTY_DATA)
    await engine.refresh()
    expect(h.onRemoteChange).not.toHaveBeenCalled()
    state.row = { data: named('newer'), revision: 2 }
    await engine.refresh()
    expect(h.onRemoteChange).toHaveBeenCalledWith(named('newer'), false)
  })
})
