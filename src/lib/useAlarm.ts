import { useCallback, useEffect, useRef, useState } from 'react'
import { armAlarm, isAlarmArmed, playAlarm, stopAlarm } from './alarm'
import { Block, blockChangedBetween } from './model'

// After a longer gap the laptop was asleep, so the block change is old news.
const MAX_CATCH_UP_MS = 2 * 60 * 1000

/** Browsers slow down page timers in background tabs, but not timers in a worker. */
function startTicking(onTick: () => void): () => void {
  try {
    const source = 'setInterval(() => postMessage(0), 1000)'
    const worker = new Worker(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })))
    worker.onmessage = onTick
    return () => worker.terminate()
  } catch {
    const timer = setInterval(onTick, 1000)
    return () => clearInterval(timer)
  }
}

export function useAlarm(blocks: Block[], on: boolean) {
  const [playing, setPlaying] = useState(false)
  const [armed, setArmed] = useState(false)
  const latest = useRef({ blocks, on })
  latest.current = { blocks, on }

  const play = useCallback((seconds?: number) => {
    setPlaying(true)
    playAlarm(() => setPlaying(false), seconds)
  }, [])

  useEffect(() => {
    let last = new Date()
    return startTicking(() => {
      const now = new Date()
      const gap = now.getTime() - last.getTime()
      const changed = blockChangedBetween(latest.current.blocks, last, now)
      last = now
      if (latest.current.on && changed && gap <= MAX_CATCH_UP_MS) play()
    })
  }, [play])

  // After a page load the browser needs one click before it will allow sound.
  useEffect(() => {
    if (!on) return
    const arm = () => armAlarm().then(setArmed).catch(() => setArmed(false))
    window.addEventListener('pointerdown', arm)
    window.addEventListener('keydown', arm)
    setArmed(isAlarmArmed())
    return () => {
      window.removeEventListener('pointerdown', arm)
      window.removeEventListener('keydown', arm)
    }
  }, [on])

  const stop = useCallback(() => {
    stopAlarm()
    setPlaying(false)
  }, [])

  return {
    playing,
    armed,
    stop,
    /** A short beep when switching on, so you know it can be heard. */
    confirm: () =>
      void armAlarm().then((ok) => {
        setArmed(ok)
        if (ok) play(0.7)
      }),
    test: () => void armAlarm().then((ok) => ok && play()),
  }
}
