import { useCallback, useEffect, useRef, useState } from 'react'
import { AppData, EMPTY_DATA, parseData } from './model'

const STORAGE_KEY = 'time-blocks/data/v1'
const UNREADABLE_KEY = 'time-blocks/data/unreadable'

function load(): AppData {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
    return raw ? parseData(JSON.parse(raw)) : EMPTY_DATA
  } catch {
    // Keep a copy rather than letting the next save overwrite it for good.
    try {
      if (raw) localStorage.setItem(UNREADABLE_KEY, raw)
    } catch {
      // Storage itself is unavailable; nothing more can be done here.
    }
    return EMPTY_DATA
  }
}

export interface Store {
  data: AppData
  update: (change: (current: AppData) => AppData) => void
  saveFailed: boolean
  notice?: { message: string } | null
  account?: { email: string; signOut: () => void } | null
}

/** Reads this browser's saved data without changing it. */
export function readLocalData(): AppData {
  return load()
}

/** App data, saved to this browser on every change and kept in sync across tabs. */
export function useLocalStore(): Store {
  const [data, setData] = useState<AppData>(load)
  const [saveFailed, setSaveFailed] = useState(false)
  // What storage already holds. Only real changes get written, so simply opening
  // the app can never overwrite saved data, even if it happened to load empty.
  const saved = useRef<string | null>(null)

  useEffect(() => {
    const json = JSON.stringify(data)
    if (saved.current === null) saved.current = json
    if (saved.current === json) return
    try {
      localStorage.setItem(STORAGE_KEY, json)
      saved.current = json
      setSaveFailed(false)
    } catch {
      setSaveFailed(true)
    }
  }, [data])

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !event.newValue) return
      try {
        const incoming = parseData(JSON.parse(event.newValue))
        saved.current = JSON.stringify(incoming)
        setData(incoming)
      } catch {
        // Ignore unreadable data from another tab and keep what's on screen.
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const update = useCallback((change: (current: AppData) => AppData) => setData(change), [])

  return { data, update, saveFailed }
}
