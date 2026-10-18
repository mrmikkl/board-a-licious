import type { Mark } from '../domain/marks.ts'
import type { MetaValues } from './store.ts'

/** The part of the browser store that holds the mute choice. */
export type FeedbackStore = {
  meta(key: 'soundOn'): Promise<MetaValues['soundOn'] | undefined>
  setMeta(key: 'soundOn', value: MetaValues['soundOn']): Promise<void>
}

type Deps = {
  /** Creates the AudioContext; null where Web Audio is missing. Called on the first gesture only. */
  audio: () => AudioContext | null
  /** `navigator.vibrate`; missing on iPhone browsers. */
  vibrate?: (pattern: number | number[]) => boolean
  store: FeedbackStore
}

const TICK = 12
const DOUBLE = [12, 60, 12]
const BOUGHT = [20, 50, 20, 50, 60]
const VOLUME = 0.25

/** Short synthesised sounds and vibration for marks and purchases (FR-026, design §10). No audio files. */
export function createFeedback({ audio, vibrate, store }: Deps) {
  let on = true
  let ctx: AudioContext | null | undefined
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach(listener => listener())

  const ready = store.meta('soundOn').then(
    stored => {
      on = stored ?? true
      notify()
    },
    () => undefined,
  )

  // Browsers block audio until a user gesture, so the context is made on the first mark, not before
  function context() {
    if (ctx === undefined) {
      try {
        ctx = audio()
      } catch {
        ctx = null
      }
    }
    if (ctx?.state === 'suspended') void ctx.resume().catch(() => undefined)
    return ctx
  }

  function buzz(pattern: number | number[]) {
    try {
      vibrate?.(pattern)
    } catch {
      // vibration is a nicety
    }
  }

  function envelope(ac: AudioContext, at: number, peak: number, length: number) {
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.linearRampToValueAtTime(peak, at + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
    gain.connect(ac.destination)
    return gain
  }

  /** A dice roll: a few decaying noise clicks, each a little softer and further apart. */
  function dice(ac: AudioContext, start: number) {
    const length = 0.035
    const samples = Math.ceil(ac.sampleRate * length)
    const buffer = ac.createBuffer(1, samples, ac.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < samples; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / samples) ** 3
    const clicks = [0, 0.05, 0.11, 0.18]
    clicks.forEach((offset, i) => {
      const at = start + offset
      const source = ac.createBufferSource()
      source.buffer = buffer
      source.connect(envelope(ac, at, VOLUME * (1 - i * 0.2), length))
      source.start(at)
      source.stop(at + length)
    })
  }

  /** Two rising notes, a fifth apart. */
  function chime(ac: AudioContext, start: number) {
    const notes: [frequency: number, offset: number][] = [
      [880, 0],
      [1320, 0.09],
    ]
    notes.forEach(([frequency, offset]) => {
      const at = start + offset
      const note = ac.createOscillator()
      note.type = 'sine'
      note.frequency.setValueAtTime(frequency, at)
      note.connect(envelope(ac, at, VOLUME * 0.8, 0.2))
      note.start(at)
      note.stop(at + 0.2)
    })
  }

  function play(sound: (ac: AudioContext, start: number) => void) {
    const ac = context()
    if (!ac) return
    try {
      sound(ac, ac.currentTime)
    } catch {
      // a broken audio stack must never break marking
    }
  }

  return {
    /** Resolves once the stored choice is known; until then sound counts as on. */
    ready,
    isOn: () => on,
    async setOn(value: boolean) {
      on = value
      notify()
      await store.setMeta('soundOn', value)
    },
    /** Called whenever sound is switched (header button and the Config switch stay in step). */
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    mark(mark: Mark) {
      if (!on) return
      play(dice)
      buzz(mark === 'must_have' ? DOUBLE : TICK)
    },
    bought() {
      if (!on) return
      play((ac, start) => {
        dice(ac, start)
        chime(ac, start + 0.1)
      })
      buzz(BOUGHT)
    },
    swipe() {
      if (on) buzz(TICK)
    },
  }
}

export type Feedback = ReturnType<typeof createFeedback>
