// Keeping browser-saved data safe: when the last backup was made, a weekly
// reminder, and asking the browser not to clear the data on its own.

const LAST_BACKUP_KEY = 'time-blocks/last-backup'
const SNOOZED_UNTIL_KEY = 'time-blocks/backup-snoozed-until'
const DAY_MS = 24 * 60 * 60 * 1000
export const BACKUP_EVERY_DAYS = 7

function readDate(key: string): Date | null {
  try {
    const value = localStorage.getItem(key)
    const date = value ? new Date(value) : null
    return date && !Number.isNaN(date.getTime()) ? date : null
  } catch {
    return null
  }
}

function writeDate(key: string, date: Date) {
  try {
    localStorage.setItem(key, date.toISOString())
  } catch {
    // Storage is unavailable; the reminder will simply show again.
  }
}

export interface BackupState {
  last: Date | null
  snoozedUntil: Date | null
}

export function readBackupState(): BackupState {
  return { last: readDate(LAST_BACKUP_KEY), snoozedUntil: readDate(SNOOZED_UNTIL_KEY) }
}

export function recordBackup(now: Date): BackupState {
  writeDate(LAST_BACKUP_KEY, now)
  return readBackupState()
}

export function snoozeBackupReminder(now: Date): BackupState {
  writeDate(SNOOZED_UNTIL_KEY, new Date(now.getTime() + DAY_MS))
  return readBackupState()
}

/** True when there is something to lose and no backup in the last week. */
export function isBackupDue(state: BackupState, now: Date, hasData: boolean): boolean {
  if (!hasData) return false
  if (state.snoozedUntil && state.snoozedUntil > now) return false
  return !state.last || now.getTime() - state.last.getTime() >= BACKUP_EVERY_DAYS * DAY_MS
}

/**
 * Asks the browser to keep this site's data even when space runs low or the site
 * isn't visited for a while. Resolves true if granted, false if refused, and null
 * if the browser doesn't support asking.
 */
export async function protectStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return null
  }
}
