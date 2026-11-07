// The app's data and rules. No React in here, so all of it can be unit tested.

export interface Todo {
  id: string
  text: string
  done: boolean
}

export interface Project {
  id: string
  name: string
  color: string
  todos: Todo[]
  /** A theme: each block gets its own name and tick, such as "Long run" under Running. */
  oneOff?: boolean
}

export interface Block {
  id: string
  projectId: string
  start: string // ISO timestamp
  end: string // ISO timestamp
  title?: string
  done?: boolean
  /** Shared by a block and its weekly repeats. */
  repeatId?: string
}

export type ViewName = 'week1' | 'week2' | 'week3' | 'month'
export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  dayStartHour: number
  dayEndHour: number
  focusLock: boolean
  alarmOn: boolean
  theme: Theme
  view: ViewName
}

export interface AppData {
  version: 1
  projects: Project[]
  blocks: Block[]
  settings: Settings
}

export const DEFAULT_SETTINGS: Settings = {
  dayStartHour: 6,
  dayEndHour: 24,
  focusLock: true,
  alarmOn: false,
  theme: 'system',
  view: 'week1',
}

export const EMPTY_DATA: AppData = {
  version: 1,
  projects: [],
  blocks: [],
  settings: DEFAULT_SETTINGS,
}

export const PALETTE = [
  '#4361ee', '#0ea5a4', '#16a34a', '#ca8a04', '#ea580c',
  '#dc2626', '#db2777', '#9333ea', '#475569', '#0284c7',
]

export const HOUR_MS = 60 * 60 * 1000
export const MIN_BLOCK_MS = HOUR_MS

export function newId(): string {
  return crypto.randomUUID()
}

/** The next palette colour no project is using yet. */
export function nextColor(projects: Project[]): string {
  const used = new Set(projects.map((p) => p.color.toLowerCase()))
  return PALETTE.find((c) => !used.has(c)) ?? PALETTE[projects.length % PALETTE.length]
}

interface Span {
  start: Date
  end: Date
}

function toSpan(block: Block): Span {
  return { start: new Date(block.start), end: new Date(block.end) }
}

function overlapsAny(span: Span, blocks: Block[], ignoreId?: string): boolean {
  return blocks.some((b) => {
    if (b.id === ignoreId) return false
    const other = toSpan(b)
    return span.start < other.end && other.start < span.end
  })
}

/** True when the span sits inside one calendar day (ending at midnight counts). */
export function isWithinOneDay(start: Date, end: Date): boolean {
  const last = new Date(end.getTime() - 1)
  return (
    start.getFullYear() === last.getFullYear() &&
    start.getMonth() === last.getMonth() &&
    start.getDate() === last.getDate()
  )
}

function atHour(day: Date, hour: number): Date {
  // new Date(y, m, d, 24) correctly gives midnight of the next day.
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour)
}

/**
 * Turns a click or drag on the grid into a valid block, or null if none fits.
 * A selection under an hour grows to one hour: forwards from its start if free,
 * otherwise backwards from its end.
 */
export function fitNewBlock(
  start: Date,
  end: Date,
  blocks: Block[],
  dayStartHour: number,
  dayEndHour: number,
): Span | null {
  const candidates: Span[] =
    end.getTime() - start.getTime() >= MIN_BLOCK_MS
      ? [{ start, end }]
      : [
          { start, end: new Date(start.getTime() + MIN_BLOCK_MS) },
          { start: new Date(end.getTime() - MIN_BLOCK_MS), end },
        ]

  const open = atHour(start, dayStartHour)
  const close = atHour(start, dayEndHour)
  return (
    candidates.find(
      (c) =>
        c.start >= open &&
        c.end <= close &&
        isWithinOneDay(c.start, c.end) &&
        !overlapsAny(c, blocks),
    ) ?? null
  )
}

/** Whether a block may take this new time when dragged or resized. */
export function canPlaceBlock(blockId: string, start: Date, end: Date, blocks: Block[]): boolean {
  return (
    end.getTime() - start.getTime() >= MIN_BLOCK_MS &&
    isWithinOneDay(start, end) &&
    !overlapsAny({ start, end }, blocks, blockId)
  )
}

export function activeBlock(blocks: Block[], now: Date): Block | null {
  return (
    blocks.find((b) => {
      const span = toSpan(b)
      return span.start <= now && now < span.end
    }) ?? null
  )
}

export function nextBlock(blocks: Block[], now: Date): Block | null {
  let best: Block | null = null
  for (const b of blocks) {
    if (new Date(b.start) > now && (!best || new Date(b.start) < new Date(best.start))) best = b
  }
  return best
}

/**
 * Whether a project's to-dos can be ticked right now. With the focus lock on,
 * a running block allows only its own project. Outside blocks everything is open.
 */
export function canWorkOn(projectId: string, data: AppData, now: Date): boolean {
  if (!data.settings.focusLock) return true
  const active = activeBlock(data.blocks, now)
  return !active || active.projectId === projectId
}

/** Whether any block starts or ends after `from`, up to and including `to`. */
export function blockChangedBetween(blocks: Block[], from: Date, to: Date): boolean {
  return blocks.some((b) => {
    const { start, end } = toSpan(b)
    return (start > from && start <= to) || (end > from && end <= to)
  })
}

/** The same local clock time a number of days later, so summer time changes don't shift blocks. */
function addDays(date: Date, days: number): Date {
  return new Date(
    date.getFullYear(), date.getMonth(), date.getDate() + days,
    date.getHours(), date.getMinutes(), date.getSeconds(),
  )
}

/**
 * Copies the blocks of the Monday-to-Sunday week starting `fromMonday` into the week
 * starting `toMonday`, at the same times. Copies are unticked, and any copy that
 * would overlap a block already there is skipped.
 */
export function copyWeek(
  blocks: Block[],
  fromMonday: Date,
  toMonday: Date,
): { added: Block[]; skipped: number } {
  const days = Math.round((toMonday.getTime() - fromMonday.getTime()) / (24 * HOUR_MS))
  const weekEnd = addDays(fromMonday, 7)
  const added: Block[] = []
  let skipped = 0
  if (days === 0) return { added, skipped }

  for (const b of blocks) {
    const { start, end } = toSpan(b)
    if (start < fromMonday || start >= weekEnd) continue
    const copy: Block = {
      id: newId(),
      projectId: b.projectId,
      start: addDays(start, days).toISOString(),
      end: addDays(end, days).toISOString(),
      ...(b.title ? { title: b.title } : {}),
    }
    if (overlapsAny(toSpan(copy), [...blocks, ...added])) skipped++
    else added.push(copy)
  }
  return { added, skipped }
}

/**
 * Copies of a block every week (or every few weeks) over the given number of weeks
 * after it, at the same time and unticked. All of them share a repeatId with the
 * original, which the caller should save on the original too. Copies that would
 * overlap a block are skipped.
 */
export function repeatWeekly(
  blocks: Block[],
  block: Block,
  weeks: number,
  everyWeeks = 1,
): { repeatId: string; added: Block[]; skipped: number } {
  const repeatId = block.repeatId ?? newId()
  const { start, end } = toSpan(block)
  const added: Block[] = []
  let skipped = 0
  for (let week = everyWeeks; week <= weeks; week += everyWeeks) {
    const copy: Block = {
      id: newId(),
      projectId: block.projectId,
      start: addDays(start, 7 * week).toISOString(),
      end: addDays(end, 7 * week).toISOString(),
      ...(block.title ? { title: block.title } : {}),
      repeatId,
    }
    if (overlapsAny(toSpan(copy), [...blocks, ...added])) skipped++
    else added.push(copy)
  }
  return { repeatId, added, skipped }
}

/** A block and the later blocks of its weekly repeat. */
export function laterRepeats(blocks: Block[], block: Block): Block[] {
  if (!block.repeatId) return [block]
  const from = new Date(block.start)
  return blocks.filter((b) => b.repeatId === block.repeatId && new Date(b.start) >= from)
}

/** Day hours to show: the chosen range, widened so no saved block is ever hidden. */
export function visibleHours(data: AppData): { startHour: number; endHour: number } {
  let startHour = data.settings.dayStartHour
  let endHour = data.settings.dayEndHour
  for (const b of data.blocks) {
    const { start, end } = toSpan(b)
    startHour = Math.min(startHour, start.getHours())
    const endsAtMidnight = end.getHours() === 0 && end.getMinutes() === 0
    endHour = Math.max(endHour, endsAtMidnight ? 24 : end.getHours() + (end.getMinutes() > 0 ? 1 : 0))
  }
  return { startHour, endHour }
}

export function hourString(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00:00`
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/** Readable text colour (near black or white) for a background colour. */
export function contrastText(hex: string): string {
  const value = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(value.slice(i, i + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return (1.05) / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? '#ffffff' : '#111827'
}

const VIEWS: ViewName[] = ['week1', 'week2', 'week3', 'month']
const THEMES: Theme[] = ['system', 'light', 'dark']

function isHour(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max
}

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime())
}

/**
 * Checks data from storage or a backup file and returns a clean copy.
 * Throws if it isn't this app's data, so a bad file can't replace good data.
 */
export function parseData(raw: unknown): AppData {
  const input = raw as Partial<AppData> | null
  if (!input || input.version !== 1 || !Array.isArray(input.projects) || !Array.isArray(input.blocks)) {
    throw new Error('Not a Time Blocks data file')
  }

  const projects: Project[] = input.projects.map((p) => {
    if (typeof p?.id !== 'string' || typeof p.name !== 'string' || !/^#[0-9a-f]{6}$/i.test(p.color)) {
      throw new Error('A project in the file is invalid')
    }
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      todos: (Array.isArray(p.todos) ? p.todos : []).map((t) => {
        if (typeof t?.id !== 'string' || typeof t.text !== 'string') {
          throw new Error('A to-do in the file is invalid')
        }
        return { id: t.id, text: t.text, done: Boolean(t.done) }
      }),
      ...(p.oneOff ? { oneOff: true } : {}),
    }
  })

  const projectIds = new Set(projects.map((p) => p.id))
  const blocks: Block[] = input.blocks.map((b) => {
    if (
      typeof b?.id !== 'string' ||
      !projectIds.has(b.projectId) ||
      !isValidDate(b.start) ||
      !isValidDate(b.end)
    ) {
      throw new Error('A time block in the file is invalid')
    }
    return {
      id: b.id,
      projectId: b.projectId,
      start: b.start,
      end: b.end,
      ...(typeof b.title === 'string' && b.title ? { title: b.title } : {}),
      ...(b.done ? { done: true } : {}),
      ...(typeof b.repeatId === 'string' && b.repeatId ? { repeatId: b.repeatId } : {}),
    }
  })

  const s: Partial<Settings> = input.settings ?? {}
  const dayStartHour = isHour(s.dayStartHour, 0, 23) ? s.dayStartHour : DEFAULT_SETTINGS.dayStartHour
  const dayEndHour = isHour(s.dayEndHour, 1, 24) ? s.dayEndHour : DEFAULT_SETTINGS.dayEndHour
  const validRange = dayStartHour < dayEndHour

  return {
    version: 1,
    projects,
    blocks,
    settings: {
      dayStartHour: validRange ? dayStartHour : DEFAULT_SETTINGS.dayStartHour,
      dayEndHour: validRange ? dayEndHour : DEFAULT_SETTINGS.dayEndHour,
      focusLock: s.focusLock !== false,
      alarmOn: s.alarmOn === true,
      theme: THEMES.includes(s.theme as Theme) ? (s.theme as Theme) : DEFAULT_SETTINGS.theme,
      view: VIEWS.includes(s.view as ViewName) ? (s.view as ViewName) : DEFAULT_SETTINGS.view,
    },
  }
}
