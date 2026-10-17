import { describe, expect, it } from 'vitest'

import { type FeedbackStore, createFeedback } from '../../src/client/feedback.ts'

type Sound = { kind: 'oscillator' | 'noise'; start: number; stop: number; frequency?: number }

/** Records what would be played instead of making noise. */
class FakeAudioContext {
  currentTime = 10
  state: 'suspended' | 'running' = 'suspended'
  sampleRate = 8000
  destination = {}
  sounds: Sound[] = []
  peakGains: number[] = []
  resumed = 0

  resume() {
    this.resumed++
    this.state = 'running'
    return Promise.resolve()
  }
  createGain() {
    const ctx = this
    const param = {
      value: 1,
      setValueAtTime(v: number) {
        ctx.peakGains.push(v)
        return param
      },
      linearRampToValueAtTime(v: number) {
        ctx.peakGains.push(v)
        return param
      },
      exponentialRampToValueAtTime(v: number) {
        ctx.peakGains.push(v)
        return param
      },
    }
    return { gain: param, connect: (to: unknown) => to }
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length)
    return { getChannelData: () => data }
  }
  createBufferSource() {
    return this.source('noise', {})
  }
  createOscillator() {
    const frequency = { value: 0, setValueAtTime: (v: number) => void (frequency.value = v) }
    return this.source('oscillator', { frequency, type: 'sine' })
  }
  private source(kind: Sound['kind'], extra: object) {
    const sound: Sound = { kind, start: 0, stop: 0 }
    const node = {
      ...extra,
      buffer: null as unknown,
      connect: (to: unknown) => to,
      start: (when = 0) => {
        sound.start = when
        if ('frequency' in extra) sound.frequency = (extra as { frequency: { value: number } }).frequency.value
      },
      stop: (when = 0) => {
        sound.stop = when
        this.sounds.push(sound)
      },
    }
    return node
  }
}

function fakeStore(soundOn?: boolean) {
  const values: { soundOn?: boolean } = { soundOn }
  const store: FeedbackStore & { values: typeof values } = {
    values,
    meta: async () => values.soundOn,
    setMeta: async (_key, value) => void (values.soundOn = value),
  }
  return store
}

function setup(soundOn?: boolean, opts: { audio?: boolean; vibrate?: boolean } = {}) {
  const contexts: FakeAudioContext[] = []
  const vibrations: (number | number[])[] = []
  const store = fakeStore(soundOn)
  const feedback = createFeedback({
    audio: () => {
      if (opts.audio === false) return null
      const ctx = new FakeAudioContext()
      contexts.push(ctx)
      return ctx as unknown as AudioContext
    },
    vibrate:
      opts.vibrate === false
        ? undefined
        : pattern => {
            vibrations.push(pattern)
            return true
          },
    store,
  })
  return { feedback, contexts, vibrations, store }
}

const lengthOf = (ctx: FakeAudioContext) =>
  Math.max(...ctx.sounds.map(s => s.stop)) - Math.min(...ctx.sounds.map(s => s.start))

describe('sound and vibration (FR-026, design §10)', () => {
  it('is on by default when nothing is stored', async () => {
    const { feedback } = setup(undefined)
    await feedback.ready
    expect(feedback.isOn()).toBe(true)
  })

  it('remembers the choice in meta.soundOn', async () => {
    const { feedback, store } = setup(true)
    await feedback.ready
    await feedback.setOn(false)
    expect(feedback.isOn()).toBe(false)
    expect(store.values.soundOn).toBe(false)

    const again = createFeedback({ audio: () => null, store })
    await again.ready
    expect(again.isOn()).toBe(false)
  })

  it('creates the audio context lazily on the first gesture, and only once', async () => {
    const { feedback, contexts } = setup()
    await feedback.ready
    expect(contexts).toHaveLength(0)
    feedback.mark('interested')
    feedback.mark('poop')
    expect(contexts).toHaveLength(1)
    expect(contexts[0]!.resumed).toBeGreaterThan(0)
  })

  it('plays a short, quiet synthesised dice roll on every mark', async () => {
    const { feedback, contexts } = setup()
    await feedback.ready
    feedback.mark('interested')
    const ctx = contexts[0]!
    expect(ctx.sounds.filter(s => s.kind === 'noise').length).toBeGreaterThanOrEqual(2)
    expect(ctx.sounds.every(s => s.start >= ctx.currentTime)).toBe(true)
    expect(lengthOf(ctx)).toBeLessThan(0.4)
    expect(Math.max(...ctx.peakGains)).toBeLessThanOrEqual(0.3)
  })

  it('adds a two-note chime for bought, still short', async () => {
    const { feedback, contexts } = setup()
    await feedback.ready
    feedback.bought()
    const ctx = contexts[0]!
    const notes = ctx.sounds.filter(s => s.kind === 'oscillator')
    expect(notes).toHaveLength(2)
    expect(notes[1]!.frequency).toBeGreaterThan(notes[0]!.frequency!)
    expect(notes[1]!.start).toBeGreaterThan(notes[0]!.start)
    expect(ctx.sounds.some(s => s.kind === 'noise')).toBe(true)
    expect(lengthOf(ctx)).toBeLessThan(0.4)
    expect(Math.max(...ctx.peakGains)).toBeLessThanOrEqual(0.3)
  })

  it('vibrates a short tick per mark or swipe, double for Must Have, longer for bought', async () => {
    const { feedback, vibrations } = setup()
    await feedback.ready
    feedback.mark('unsure')
    feedback.swipe()
    feedback.mark('must_have')
    feedback.bought()
    const [tick, swipe, must, bought] = vibrations
    expect(tick).toBeTypeOf('number')
    expect(swipe).toEqual(tick)
    expect(Array.isArray(must) && must.length).toBe(3)
    const total = (p: number | number[]) => (Array.isArray(p) ? p.reduce((a, b) => a + b, 0) : p)
    expect(total(bought!)).toBeGreaterThan(total(must!))
  })

  it('a swipe only vibrates, it plays no sound', async () => {
    const { feedback, contexts } = setup()
    await feedback.ready
    feedback.swipe()
    expect(contexts.flatMap(c => c.sounds)).toEqual([])
  })

  it('muted: no sound and no vibration', async () => {
    const { feedback, contexts, vibrations } = setup(false)
    await feedback.ready
    feedback.mark('must_have')
    feedback.bought()
    feedback.swipe()
    expect(contexts.flatMap(c => c.sounds)).toEqual([])
    expect(vibrations).toEqual([])
  })

  it('does nothing and does not throw without Web Audio or vibration (iPhone)', async () => {
    const { feedback } = setup(true, { audio: false, vibrate: false })
    await feedback.ready
    expect(() => {
      feedback.mark('must_have')
      feedback.bought()
      feedback.swipe()
    }).not.toThrow()
  })

  it('stays on by default when the store cannot be read', async () => {
    const feedback = createFeedback({
      audio: () => null,
      store: { meta: () => Promise.reject(new Error('blocked')), setMeta: async () => undefined },
    })
    await feedback.ready
    expect(feedback.isOn()).toBe(true)
  })
})
