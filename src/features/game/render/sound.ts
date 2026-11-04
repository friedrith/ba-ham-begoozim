import { ICICLE_WARNING, type GameEvent } from '../engine/world'

/** Each bean holds one note of a major chord, so a harmony really is a chord. */
const SEAT_NOTES = [130.81, 164.81, 196, 261.63]
const CHIME = [523.25, 659.25, 783.99, 1046.5]

type Voice = { stop: () => void }

export class Sound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private voices: (Voice | null)[] = [null, null, null, null]
  muted = false

  /** Browsers only allow audio after a gesture, so call this from one. */
  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.7
      this.master.connect(this.ctx.destination)
      this.noise = this.ctx.createBuffer(
        1,
        this.ctx.sampleRate,
        this.ctx.sampleRate,
      )
      const data = this.noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (this.master) this.master.gain.value = muted ? 0 : 0.7
  }

  stopAll() {
    this.voices.forEach((voice, i) => {
      voice?.stop()
      this.voices[i] = null
    })
  }

  handle(event: GameEvent) {
    switch (event.type) {
      case 'blast':
        this.startVoice(event.seat, event.harmony || event.ignited)
        if (event.ignited) this.whoosh()
        break
      case 'release':
        this.voices[event.seat]?.stop()
        this.voices[event.seat] = null
        break
      case 'empty':
        this.tone(
          SEAT_NOTES[event.seat] * 3,
          SEAT_NOTES[event.seat] * 1.5,
          0.14,
          'square',
          0.08,
        )
        break
      case 'harmony':
        CHIME.forEach((f, i) => this.tone(f, f, 0.22, 'triangle', 0.09, i * 0.04))
        break
      case 'can':
        this.tone(880, 1320, 0.12, 'triangle', 0.2)
        this.tone(1320, 1760, 0.14, 'triangle', 0.14, 0.08)
        break
      case 'creak':
        this.tone(1400, 520, ICICLE_WARNING, 'sine', 0.05)
        this.tone(1450, 540, ICICLE_WARNING, 'triangle', 0.03)
        break
      case 'smash':
        this.whoosh(0.3, 6000)
        this.tone(2400, 1200, 0.1, 'square', 0.05)
        this.tone(1800, 700, 0.18, 'triangle', 0.09, 0.03)
        break
      case 'skid':
        this.whoosh(0.5, 9000)
        this.tone(900, 1300, 0.3, 'sine', 0.06)
        break
      case 'bump':
        this.tone(110, 50, 0.16, 'sine', Math.min(0.5, event.force / 400))
        break
      case 'respawn':
        this.stopAll()
        this.tone(440, 60, 0.7, 'sine', 0.3)
        break
      case 'checkpoint':
        this.tone(660, 660, 0.09, 'square', 0.06)
        this.tone(880, 880, 0.14, 'square', 0.06, 0.09)
        break
      case 'tick':
        this.tone(440, 440, 0.14, 'square', 0.1)
        break
      case 'go':
        this.tone(880, 880, 0.35, 'square', 0.1)
        break
      case 'finish':
        this.stopAll()
        CHIME.forEach((f, i) => this.tone(f, f, 0.5, 'triangle', 0.18, i * 0.13))
        break
      default:
        break
    }
  }

  /** A sustained toot: buzzy saw through a low-pass with a fast flutter, plus air. */
  private startVoice(seat: number, big: boolean) {
    const { ctx, master, noise } = this
    if (!ctx || !master || !noise) return
    this.voices[seat]?.stop()

    const now = ctx.currentTime
    const base = SEAT_NOTES[seat]
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(base * 1.3, now)
    osc.frequency.exponentialRampToValueAtTime(base, now + 0.09)
    osc.frequency.exponentialRampToValueAtTime(base * 0.8, now + 2.5)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 780
    filter.Q.value = 5

    const flutter = ctx.createGain()
    flutter.gain.value = 0.55
    const lfo = ctx.createOscillator()
    lfo.type = 'square'
    lfo.frequency.value = 24 + seat * 3
    const lfoDepth = ctx.createGain()
    lfoDepth.gain.value = 0.45
    lfo.connect(lfoDepth).connect(flutter.gain)

    const air = ctx.createBufferSource()
    air.buffer = noise
    air.loop = true
    const airFilter = ctx.createBiquadFilter()
    airFilter.type = 'bandpass'
    airFilter.frequency.value = 320
    const airGain = ctx.createGain()
    airGain.gain.value = 0.25
    air.connect(airFilter).connect(airGain).connect(flutter)

    const envelope = ctx.createGain()
    const peak = big ? 0.4 : 0.28
    envelope.gain.setValueAtTime(0.001, now)
    envelope.gain.exponentialRampToValueAtTime(peak, now + 0.015)
    envelope.gain.exponentialRampToValueAtTime(peak * 0.55, now + 0.2)

    osc.connect(filter).connect(flutter).connect(envelope).connect(master)
    osc.start(now)
    lfo.start(now)
    air.start(now)

    this.voices[seat] = {
      stop: () => {
        const end = ctx.currentTime
        envelope.gain.cancelScheduledValues(end)
        envelope.gain.setValueAtTime(Math.max(envelope.gain.value, 0.001), end)
        envelope.gain.exponentialRampToValueAtTime(0.001, end + 0.07)
        osc.stop(end + 0.09)
        lfo.stop(end + 0.09)
        air.stop(end + 0.09)
      },
    }
  }

  /** A burst of filtered noise that falls away. */
  private whoosh(duration = 0.7, brightness = 3000) {
    const { ctx, master, noise } = this
    if (!ctx || !master || !noise) return
    const now = ctx.currentTime
    const source = ctx.createBufferSource()
    source.buffer = noise
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(brightness, now)
    filter.frequency.exponentialRampToValueAtTime(200, now + duration)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.6, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    source.connect(filter).connect(gain).connect(master)
    source.start(now)
    source.stop(now + duration)
  }

  private tone(
    from: number,
    to: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
  ) {
    const { ctx, master } = this
    if (!ctx || !master) return
    const start = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(from, start)
    osc.frequency.exponentialRampToValueAtTime(to, start + duration)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
    osc.connect(gain).connect(master)
    osc.start(start)
    osc.stop(start + duration)
  }
}
