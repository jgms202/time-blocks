import { describe, expect, it } from 'vitest'
import {
  activeBlock,
  AppData,
  blockChangedBetween,
  Block,
  canPlaceBlock,
  canWorkOn,
  contrastText,
  copyWeek,
  EMPTY_DATA,
  fitNewBlock,
  laterRepeats,
  nextBlock,
  parseData,
  repeatWeekly,
  visibleHours,
} from './model'

// Monday 9 November 2026, in local time.
const at = (hour: number, minute = 0, day = 9) => new Date(2026, 10, day, hour, minute)
const block = (id: string, start: Date, end: Date, projectId = 'a'): Block => ({
  id,
  projectId,
  start: start.toISOString(),
  end: end.toISOString(),
})
const withBlocks = (blocks: Block[], focusLock = true): AppData => ({
  ...EMPTY_DATA,
  blocks,
  settings: { ...EMPTY_DATA.settings, focusLock },
})

describe('fitNewBlock', () => {
  it('grows a half-hour click to one hour', () => {
    const fit = fitNewBlock(at(10), at(10, 30), [], 6, 24)
    expect(fit).toEqual({ start: at(10), end: at(11) })
  })

  it('keeps a drag that is already over an hour, on half-hour edges', () => {
    const fit = fitNewBlock(at(10, 30), at(12), [], 6, 24)
    expect(fit).toEqual({ start: at(10, 30), end: at(12) })
  })

  it('grows backwards when the next half hour is taken', () => {
    const taken = [block('x', at(11), at(12))]
    const fit = fitNewBlock(at(10, 30), at(11), taken, 6, 24)
    expect(fit).toEqual({ start: at(10), end: at(11) })
  })

  it('refuses when no full hour is free around the click', () => {
    const taken = [block('x', at(9), at(10)), block('y', at(11), at(12))]
    // 10:00 to 11:00 is free, so a click at 10:00 fits...
    expect(fitNewBlock(at(10), at(10, 30), taken, 6, 24)).toEqual({ start: at(10), end: at(11) })
    // ...but with only 30 minutes free there is nothing to place.
    const tight = [block('x', at(9), at(10, 30)), block('y', at(11), at(12))]
    expect(fitNewBlock(at(10, 30), at(11), tight, 6, 24)).toBeNull()
  })

  it('stays inside the visible day at both ends', () => {
    expect(fitNewBlock(at(23, 30), at(24), [], 6, 24)).toEqual({ start: at(23), end: at(24) })
    expect(fitNewBlock(at(6), at(6, 30), [], 6, 24)).toEqual({ start: at(6), end: at(7) })
  })

  it('refuses a selection that spans two days', () => {
    expect(fitNewBlock(at(22), at(9, 0, 10), [], 6, 24)).toBeNull()
  })

  it('allows blocks that touch', () => {
    const taken = [block('x', at(9), at(10))]
    expect(fitNewBlock(at(10), at(11), taken, 6, 24)).not.toBeNull()
  })
})

describe('canPlaceBlock', () => {
  const others = [block('other', at(12), at(13))]

  it('rejects anything under an hour', () => {
    expect(canPlaceBlock('me', at(9), at(9, 30), others)).toBe(false)
  })

  it('accepts exactly an hour', () => {
    expect(canPlaceBlock('me', at(9), at(10), others)).toBe(true)
  })

  it('rejects overlaps with other blocks but ignores itself', () => {
    expect(canPlaceBlock('me', at(11, 30), at(12, 30), others)).toBe(false)
    expect(canPlaceBlock('other', at(12, 30), at(13, 30), others)).toBe(true)
  })

  it('rejects crossing midnight but allows ending at midnight', () => {
    expect(canPlaceBlock('me', at(23), at(1, 0, 10), [])).toBe(false)
    expect(canPlaceBlock('me', at(23), at(24), [])).toBe(true)
  })
})

describe('activeBlock and nextBlock', () => {
  const blocks = [block('b', at(14), at(15)), block('a', at(9), at(10))]

  it('includes the start minute and excludes the end minute', () => {
    expect(activeBlock(blocks, at(9))?.id).toBe('a')
    expect(activeBlock(blocks, at(9, 59))?.id).toBe('a')
    expect(activeBlock(blocks, at(10))).toBeNull()
  })

  it('finds the soonest upcoming block regardless of list order', () => {
    expect(nextBlock(blocks, at(8))?.id).toBe('a')
    expect(nextBlock(blocks, at(11))?.id).toBe('b')
    expect(nextBlock(blocks, at(16))).toBeNull()
  })
})

describe('canWorkOn', () => {
  const blocks = [block('b1', at(9), at(10), 'a')]

  it('allows only the running block\'s project', () => {
    const data = withBlocks(blocks)
    expect(canWorkOn('a', data, at(9, 30))).toBe(true)
    expect(canWorkOn('b', data, at(9, 30))).toBe(false)
  })

  it('leaves every project open outside blocks', () => {
    expect(canWorkOn('b', withBlocks(blocks), at(11))).toBe(true)
  })

  it('leaves every project open with the lock off', () => {
    expect(canWorkOn('b', withBlocks(blocks, false), at(9, 30))).toBe(true)
  })
})

describe('visibleHours', () => {
  it('uses the settings when no blocks fall outside them', () => {
    expect(visibleHours(withBlocks([block('x', at(9), at(10))]))).toEqual({ startHour: 6, endHour: 24 })
  })

  it('widens to keep saved blocks visible', () => {
    const data = withBlocks([block('x', at(5), at(6))])
    data.settings = { ...data.settings, dayStartHour: 8, dayEndHour: 18 }
    expect(visibleHours(data)).toEqual({ startHour: 5, endHour: 18 })
    data.blocks = [block('y', at(18), at(19, 30))]
    expect(visibleHours(data)).toEqual({ startHour: 8, endHour: 20 })
    data.blocks = [block('z', at(23), at(24))]
    expect(visibleHours(data)).toEqual({ startHour: 8, endHour: 24 })
  })
})

describe('blockChangedBetween', () => {
  const blocks = [block('a', at(9), at(10))]

  it('sees a block starting or ending in the window', () => {
    expect(blockChangedBetween(blocks, at(8, 59), at(9))).toBe(true)
    expect(blockChangedBetween(blocks, at(9, 59), at(10))).toBe(true)
  })

  it('stays quiet in the middle of a block', () => {
    expect(blockChangedBetween(blocks, at(9, 30), at(9, 31))).toBe(false)
  })

  it('does not fire twice for the same moment', () => {
    expect(blockChangedBetween(blocks, at(9), at(9, 1))).toBe(false)
  })
})

describe('copyWeek', () => {
  const monday = at(0)
  const nextMonday = at(0, 0, 16)

  it('copies a week to the same days and times a week later', () => {
    const blocks = [block('a', at(9), at(10)), block('b', at(14, 30), at(16), 'b')]
    const { added, skipped } = copyWeek(blocks, monday, nextMonday)
    expect(skipped).toBe(0)
    expect(added.map((b) => [b.start, b.end, b.projectId])).toEqual([
      [at(9, 0, 16).toISOString(), at(10, 0, 16).toISOString(), 'a'],
      [at(14, 30, 16).toISOString(), at(16, 0, 16).toISOString(), 'b'],
    ])
    expect(new Set(added.map((b) => b.id)).size).toBe(2)
    expect(added.some((b) => blocks.some((o) => o.id === b.id))).toBe(false)
  })

  it('only copies blocks inside the source week, Sunday included', () => {
    const blocks = [
      block('sun', at(22, 0, 15), at(24, 0, 15)),
      block('before', at(9, 0, 8), at(10, 0, 8)),
      block('after', at(9, 0, 16), at(10, 0, 16)),
    ]
    // Two weeks ahead, so the 15th lands on the 29th.
    expect(copyWeek(blocks, monday, at(0, 0, 23)).added.map((b) => b.start)).toEqual([
      at(22, 0, 29).toISOString(),
    ])
  })

  it('keeps names but not ticks', () => {
    const named = { ...block('a', at(9), at(10)), title: 'Long run', done: true }
    const [copy] = copyWeek([named], monday, nextMonday).added
    expect(copy.title).toBe('Long run')
    expect(copy.done).toBeUndefined()
  })

  it('skips copies that would overlap blocks already in the target week', () => {
    const blocks = [block('a', at(9), at(10)), block('b', at(11), at(12)), block('x', at(9, 30, 16), at(10, 30, 16))]
    const { added, skipped } = copyWeek(blocks, monday, nextMonday)
    expect(skipped).toBe(1)
    expect(added.map((b) => b.start)).toEqual([at(11, 0, 16).toISOString()])
  })

  it('copies nothing onto the same week', () => {
    expect(copyWeek([block('a', at(9), at(10))], monday, monday)).toEqual({ added: [], skipped: 0 })
  })

  it('keeps clock times across the change from summer time', () => {
    // UK clocks went back on Sunday 25 October 2026.
    const blocks = [block('a', new Date(2026, 9, 21, 9), new Date(2026, 9, 21, 10))]
    const [copy] = copyWeek(blocks, new Date(2026, 9, 19), new Date(2026, 9, 26)).added
    expect(new Date(copy.start).getHours()).toBe(9)
    expect(new Date(copy.start).getDate()).toBe(28)
  })
})

describe('repeatWeekly', () => {
  it('adds a copy each week at the same time, sharing a repeat id', () => {
    const meeting = { ...block('m', at(14), at(15)), title: 'Supervisor', done: true }
    const { repeatId, added, skipped } = repeatWeekly([meeting], meeting, 3)
    expect(skipped).toBe(0)
    expect(added.map((b) => b.start)).toEqual([16, 23, 30].map((d) => at(14, 0, d).toISOString()))
    expect(added.every((b) => b.repeatId === repeatId && b.title === 'Supervisor' && !b.done)).toBe(true)
    expect(new Set(added.map((b) => b.id)).size).toBe(3)
  })

  it('repeats every two weeks', () => {
    const meeting = block('m', at(14), at(15))
    const { added } = repeatWeekly([meeting], meeting, 8, 2)
    expect(added.map((b) => b.start)).toEqual(
      [new Date(2026, 10, 23), new Date(2026, 11, 7), new Date(2026, 11, 21), new Date(2027, 0, 4)].map(
        (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 14).toISOString(),
      ),
    )
  })

  it('keeps the repeat id of a block that already repeats', () => {
    const repeating = { ...block('m', at(14), at(15)), repeatId: 'r1' }
    expect(repeatWeekly([repeating], repeating, 1).repeatId).toBe('r1')
  })

  it('skips weeks where the time is taken', () => {
    const meeting = block('m', at(14), at(15))
    const busy = block('x', at(14, 30, 23), at(16, 0, 23))
    const { added, skipped } = repeatWeekly([meeting, busy], meeting, 3)
    expect(skipped).toBe(1)
    expect(added.map((b) => new Date(b.start).getDate())).toEqual([16, 30])
  })
})

describe('laterRepeats', () => {
  const series = [9, 16, 23].map((d) => ({ ...block(`m${d}`, at(14, 0, d), at(15, 0, d)), repeatId: 'r' }))
  const other = { ...block('o', at(9, 0, 23), at(10, 0, 23)), repeatId: 'other' }

  it('finds this block and later ones in the same repeat', () => {
    expect(laterRepeats([...series, other], series[1]).map((b) => b.id)).toEqual(['m16', 'm23'])
  })

  it('returns just the block when it does not repeat', () => {
    const single = block('s', at(9), at(10))
    expect(laterRepeats([single, ...series], single)).toEqual([single])
  })
})

describe('contrastText', () => {
  it('picks dark text on light colours and white on dark ones', () => {
    expect(contrastText('#ffffff')).toBe('#111827')
    expect(contrastText('#000000')).toBe('#ffffff')
    expect(contrastText('#4361ee')).toBe('#ffffff')
  })
})

describe('parseData', () => {
  const valid = {
    version: 1,
    projects: [{ id: 'a', name: 'A', color: '#112233', todos: [{ id: 't', text: 'x', done: true }] }],
    blocks: [block('b', at(9), at(10))],
    settings: EMPTY_DATA.settings,
  }

  it('accepts good data unchanged', () => {
    expect(parseData(valid)).toEqual(valid)
  })

  it('keeps block names, ticks and themes', () => {
    const named = {
      ...valid,
      projects: [{ ...valid.projects[0], oneOff: true }],
      blocks: [{ ...block('b', at(9), at(10)), title: 'Long run', done: true, repeatId: 'r' }],
    }
    expect(parseData(named)).toEqual(named)
  })

  it('reads data saved before names, ticks and the alarm existed', () => {
    const { alarmOn, ...oldSettings } = EMPTY_DATA.settings
    const parsed = parseData({ ...valid, settings: oldSettings })
    expect(alarmOn).toBe(false)
    expect(parsed.settings.alarmOn).toBe(false)
    expect(parsed.blocks[0].done).toBeUndefined()
  })

  it('throws on files that are not this app\'s data', () => {
    expect(() => parseData(null)).toThrow()
    expect(() => parseData({ foo: 1 })).toThrow()
    expect(() => parseData({ ...valid, version: 2 })).toThrow()
  })

  it('throws on a block pointing at a missing project or a bad date', () => {
    expect(() => parseData({ ...valid, blocks: [block('b', at(9), at(10), 'gone')] })).toThrow()
    expect(() =>
      parseData({ ...valid, blocks: [{ id: 'b', projectId: 'a', start: 'nope', end: 'nope' }] }),
    ).toThrow()
  })

  it('throws on a colour that could not be used', () => {
    expect(() => parseData({ ...valid, projects: [{ ...valid.projects[0], color: 'red' }] })).toThrow()
  })

  it('falls back to defaults for missing or invalid settings', () => {
    const parsed = parseData({
      ...valid,
      settings: { dayStartHour: 20, dayEndHour: 8, focusLock: false, theme: 'neon', view: 'year' },
    })
    expect(parsed.settings).toEqual({ ...EMPTY_DATA.settings, focusLock: false })
  })
})
