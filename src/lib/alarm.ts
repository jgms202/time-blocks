// The alarm is synthesised, so there is no sound file to load or fail.
// Browsers only allow sound after a click on the page, hence armAlarm().

const ALARM_SECONDS = 10
const BEEP_SECONDS = 0.28
const PATTERN_SECONDS = 0.75

let context: AudioContext | null = null
let output: GainNode | null = null
let endTimer: ReturnType<typeof setTimeout> | null = null

function getContext(): AudioContext {
  if (!context) context = new AudioContext()
  return context
}

export function isAlarmArmed(): boolean {
  return context?.state === 'running'
}

export async function armAlarm(): Promise<boolean> {
  const ctx = getContext()
  if (ctx.state !== 'running') await ctx.resume()
  return ctx.state === 'running'
}

function beep(ctx: AudioContext, destination: AudioNode, at: number, frequency: number) {
  const oscillator = ctx.createOscillator()
  const envelope = ctx.createGain()
  oscillator.type = 'square'
  oscillator.frequency.value = frequency
  envelope.gain.setValueAtTime(0, at)
  envelope.gain.linearRampToValueAtTime(1, at + 0.005)
  envelope.gain.setValueAtTime(1, at + BEEP_SECONDS - 0.005)
  envelope.gain.linearRampToValueAtTime(0, at + BEEP_SECONDS)
  oscillator.connect(envelope).connect(destination)
  oscillator.start(at)
  oscillator.stop(at + BEEP_SECONDS)
}

export function stopAlarm() {
  if (endTimer) clearTimeout(endTimer)
  endTimer = null
  output?.disconnect()
  output = null
}

/** Plays at full volume within the page. The Mac's own volume setting still applies. */
export function playAlarm(onEnd: () => void, seconds = ALARM_SECONDS) {
  const ctx = getContext()
  stopAlarm()
  const gain = ctx.createGain()
  gain.gain.value = 1
  gain.connect(ctx.destination)
  output = gain
  const start = ctx.currentTime + 0.02
  for (let t = 0; t < seconds; t += PATTERN_SECONDS) {
    beep(ctx, gain, start + t, 880)
    if (t + PATTERN_SECONDS / 2 < seconds) beep(ctx, gain, start + t + PATTERN_SECONDS / 2, 1320)
  }
  endTimer = setTimeout(() => {
    stopAlarm()
    onEnd()
  }, seconds * 1000)
}
