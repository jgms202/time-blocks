import { AppData, parseData } from './model'

export interface Remote {
  data: unknown
  revision: number
}

/** Where a signed-in person's data lives. Kept this small so it can be tested with a fake. */
export interface Backend {
  fetch: () => Promise<Remote | null>
  insert: (data: AppData) => Promise<void>
  /** Saves only if nobody else saved since `revision`. False means somebody did. */
  update: (data: AppData, revision: number) => Promise<boolean>
}

interface Handlers {
  onRemoteChange: (data: AppData, lostChanges: boolean) => void
  onSaveStatus: (failed: boolean) => void
}

const RETRY_MS = 10_000

export class SyncEngine {
  private revision = 0
  private pending: AppData | null = null
  private inFlight = false
  private retryTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private backend: Backend,
    private handlers: Handlers,
  ) {}

  get hasUnsaved(): boolean {
    return this.pending !== null || this.inFlight
  }

  /** Loads the person's data. Throws rather than ever saving over data it can't read. */
  async start(firstTimeData: () => AppData): Promise<AppData> {
    const remote = await this.backend.fetch()
    if (remote) {
      this.revision = remote.revision
      return parseData(remote.data)
    }
    const initial = firstTimeData()
    try {
      await this.backend.insert(initial)
      this.revision = 1
      return initial
    } catch (error) {
      // Another tab may have created the row first, in which case use that one.
      const created = await this.backend.fetch()
      if (!created) throw error
      this.revision = created.revision
      return parseData(created.data)
    }
  }

  save(data: AppData) {
    this.pending = data
    void this.flush()
  }

  /** Picks up changes made on another device, unless there are unsaved ones here. */
  async refresh() {
    if (this.hasUnsaved) return
    try {
      const remote = await this.backend.fetch()
      if (!remote || remote.revision <= this.revision || this.hasUnsaved) return
      const data = parseData(remote.data)
      this.revision = remote.revision
      this.handlers.onRemoteChange(data, false)
    } catch {
      // Offline or unreadable: keep what's on screen and try on the next refresh.
    }
  }

  dispose() {
    if (this.retryTimer) clearTimeout(this.retryTimer)
  }

  private async flush() {
    if (this.inFlight || !this.pending) return
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
    const data = this.pending
    this.pending = null
    this.inFlight = true
    try {
      if (await this.backend.update(data, this.revision)) {
        this.revision += 1
        this.handlers.onSaveStatus(false)
      } else {
        // Another device saved first. Its version wins and this one's latest edit is dropped.
        const remote = await this.backend.fetch()
        if (!remote) throw new Error('Saved data has gone missing')
        const current = parseData(remote.data)
        this.revision = remote.revision
        this.pending = null
        this.handlers.onSaveStatus(false)
        this.handlers.onRemoteChange(current, true)
      }
    } catch {
      this.pending = this.pending ?? data
      this.handlers.onSaveStatus(true)
      this.retryTimer = setTimeout(() => void this.flush(), RETRY_MS)
      this.inFlight = false
      return
    }
    this.inFlight = false
    void this.flush()
  }
}
