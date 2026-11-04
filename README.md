# Ba Ham Begoozim

A couch co-op browser game. Four baked beans share one clawfoot bathtub, and the
only engine on board is what the beans had for lunch. Everyone blasts from their
own corner, so steering takes teamwork.

Play it at <https://ba-ham-begoozim.vercel.app>.

## Running it

```bash
bun install && bun dev
```

## Controls

| Seat        | Key | Effect                      |
| ----------- | --- | --------------------------- |
| Front left  | `Q` | Pushes back, turns left     |
| Front right | `P` | Pushes back, turns right    |
| Rear left   | `Z` | Pushes forward, turns right |
| Rear right  | `M` | Pushes forward, turns left  |

Playing solo? `←` and `→` work the rear seats and `↓` works both front seats. On
a touch screen each bean owns a quarter of the screen: hold your corner to blast.
`Esc` pauses, `R` restarts.

Blast within a blink of another bean for a **harmony**: a bigger shove, a little
gas back, and a chord.

## Languages

The game follows the browser's language, and the menu has a switcher that remembers
the choice. In Persian (فارسی) the layout runs right to left, but seats and keys stay
in the same physical place: the labels `ض`, `ح`, `ظ` and `پ` are the same keys as `Q`,
`P`, `Z` and `M` on the standard Persian layout (ISIRI 9147).

## How it's built

- `src/features/game/engine` — deterministic, DOM-free simulation and levels.
- `src/features/game/render` — Canvas 2D scene, particles and the WebAudio synth.
- `src/features/game/components` — menu, HUD and the game loop.
- `src/features/game/i18n` — English and Persian text, language choice and number
  formatting. A new level needs an entry under its id in both `en.ts` and `fa.ts`,
  and the tests fail until it has one.

`bun test` runs a bot through every level, so a course that can't be finished
fails the suite. The same bot drives the demo behind the menu.

## Analytics

Pageviews and game events (`level_started`, `level_finished`, `level_abandoned`)
go to [PostHog](https://posthog.com) when these variables are set. The Vercel
integration sets them for Preview and Production, so local dev sends nothing.
PostHog is used for analytics only: flags, replay, surveys and the rest stay off.

| Variable                            | Value                                                  |
| ----------------------------------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | Project token                                          |
| `NEXT_PUBLIC_POSTHOG_HOST`          | Ingestion host, defaults to `https://us.i.posthog.com` |

The game runs PostHog in cookieless mode, so **turn on cookieless server hash mode
in the PostHog project settings**. PostHog drops the events otherwise.

`bun run analytics` opens the PostHog dashboard. It needs the Vercel CLI, logged in
with access to the Interaction Dynamics team.
