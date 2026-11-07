import { describe, expect, it } from 'vitest'
import { isBackupDue } from './backup'

const now = new Date(2026, 10, 20, 12)
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

describe('isBackupDue', () => {
  it('stays quiet when there is nothing to lose', () => {
    expect(isBackupDue({ last: null, snoozedUntil: null }, now, false)).toBe(false)
  })

  it('asks when there has never been a backup', () => {
    expect(isBackupDue({ last: null, snoozedUntil: null }, now, true)).toBe(true)
  })

  it('asks again once the last backup is a week old', () => {
    expect(isBackupDue({ last: daysAgo(6.9), snoozedUntil: null }, now, true)).toBe(false)
    expect(isBackupDue({ last: daysAgo(7), snoozedUntil: null }, now, true)).toBe(true)
  })

  it('stays quiet while snoozed, then asks again', () => {
    expect(isBackupDue({ last: null, snoozedUntil: daysAgo(-0.5) }, now, true)).toBe(false)
    expect(isBackupDue({ last: null, snoozedUntil: daysAgo(0.5) }, now, true)).toBe(true)
  })
})
