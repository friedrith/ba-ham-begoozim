import posthog from 'posthog-js'

type GameEvents = {
  level_started: { level_id: string }
  level_finished: {
    level_id: string
    time: number
    par: number
    stars: number
    cans: number
    total_cans: number
    harmonies: number
    wipeouts: number
  }
  level_abandoned: {
    level_id: string
    reason: 'restart' | 'menu'
    race_time: number
  }
}

// PostHog only loads when a key is configured, see instrumentation-client.ts.
export function track<Name extends keyof GameEvents>(
  name: Name,
  properties: GameEvents[Name],
) {
  if (posthog.__loaded) posthog.capture(name, properties)
}

/** Attaches the current input mode to every event that follows. */
export function setInputMode(input: 'touch' | 'keyboard') {
  if (posthog.__loaded) posthog.register({ input })
}
