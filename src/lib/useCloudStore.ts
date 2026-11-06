import { useCallback, useEffect, useRef, useState } from 'react'
import { SupabaseClient, User } from '@supabase/supabase-js'
import { cloudBackend } from './cloud'
import { AppData, EMPTY_DATA } from './model'
import { readLocalData, Store } from './store'
import { SyncEngine } from './sync'

const IMPORTED_KEY = 'time-blocks/data/imported-to-account'
const SAVE_DELAY_MS = 600

/** The first account to sign in on a browser takes over anything already saved in it, once. */
function firstTimeData(): AppData {
  try {
    if (localStorage.getItem(IMPORTED_KEY)) return EMPTY_DATA
  } catch {
    return EMPTY_DATA
  }
  return readLocalData()
}

function markImported() {
  try {
    localStorage.setItem(IMPORTED_KEY, 'yes')
  } catch {
    // Storage is unavailable, so there was nothing here to import anyway.
  }
}

export type CloudState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; store: Store }

export function useCloudStore(client: SupabaseClient, user: User): CloudState & { retry: () => void } {
  const [data, setData] = useState<AppData | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [notice, setNotice] = useState<{ message: string } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const engine = useRef<SyncEngine | null>(null)
  const lastSynced = useRef<AppData | null>(null) // what the server already has
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    const sync = new SyncEngine(cloudBackend(client, user.id), {
      onRemoteChange: (remote, lostChanges) => {
        lastSynced.current = remote
        setData(remote)
        if (lostChanges) {
          setNotice({ message: 'Updated from another device. Your last change here wasn’t kept.' })
        }
      },
      onSaveStatus: setSaveFailed,
    })
    engine.current = sync
    setLoadFailed(false)
    sync
      .start(firstTimeData)
      .then((loaded) => {
        markImported()
        if (cancelled) return
        lastSynced.current = loaded
        setData(loaded)
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true)
      })

    const refresh = () => {
      if (document.visibilityState === 'visible' && !saveTimer.current) void sync.refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      cancelled = true
      sync.dispose()
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [client, user.id, attempt])

  useEffect(() => {
    if (!data || data === lastSynced.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      engine.current?.save(data)
    }, SAVE_DELAY_MS)
  }, [data])

  useEffect(() => {
    function warnIfUnsaved(event: BeforeUnloadEvent) {
      if (saveTimer.current || engine.current?.hasUnsaved) event.preventDefault()
    }
    window.addEventListener('beforeunload', warnIfUnsaved)
    return () => window.removeEventListener('beforeunload', warnIfUnsaved)
  }, [])

  const update = useCallback(
    (change: (current: AppData) => AppData) => setData((current) => (current ? change(current) : current)),
    [],
  )
  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  if (loadFailed) return { status: 'error', retry }
  if (!data) return { status: 'loading', retry }
  return {
    status: 'ready',
    retry,
    store: {
      data,
      update,
      saveFailed,
      notice,
      account: { email: user.email ?? 'Signed in', signOut: () => void client.auth.signOut() },
    },
  }
}
